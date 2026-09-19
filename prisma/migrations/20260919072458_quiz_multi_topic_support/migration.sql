-- CreateTable
CREATE TABLE "QuizSessionTopic" (
    "quizSessionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    PRIMARY KEY ("quizSessionId", "topicId"),
    CONSTRAINT "QuizSessionTopic_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "QuizSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizSessionTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing single-topic quiz sessions into the join table before
-- the old topicId column is dropped below.
INSERT INTO "QuizSessionTopic" ("quizSessionId", "topicId")
SELECT "id", "topicId" FROM "QuizSession" WHERE "topicId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuizSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL DEFAULT 'single',
    "difficulty" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "score" INTEGER,
    "aiProvider" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);
INSERT INTO "new_QuizSession" ("aiModel", "aiProvider", "completedAt", "difficulty", "id", "questionCount", "score", "startedAt") SELECT "aiModel", "aiProvider", "completedAt", "difficulty", "id", "questionCount", "score", "startedAt" FROM "QuizSession";
DROP TABLE "QuizSession";
ALTER TABLE "new_QuizSession" RENAME TO "QuizSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "QuizSessionTopic_topicId_idx" ON "QuizSessionTopic"("topicId");
