-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "score" INTEGER,
    "aiProvider" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "QuizSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizSessionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    CONSTRAINT "QuizQuestion_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "QuizSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizQuestionId" TEXT NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAnswer_quizQuestionId_fkey" FOREIGN KEY ("quizQuestionId") REFERENCES "QuizQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuizSession_topicId_idx" ON "QuizSession"("topicId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizSessionId_idx" ON "QuizQuestion"("quizSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_quizQuestionId_key" ON "QuizAnswer"("quizQuestionId");
