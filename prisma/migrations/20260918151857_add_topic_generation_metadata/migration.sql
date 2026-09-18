-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "aiBatchId" TEXT,
    CONSTRAINT "Topic_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Topic" ("categoryId", "content", "createdAt", "id", "slug", "summary", "title", "updatedAt") SELECT "categoryId", "content", "createdAt", "id", "slug", "summary", "title", "updatedAt" FROM "Topic";
DROP TABLE "Topic";
ALTER TABLE "new_Topic" RENAME TO "Topic";
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");
CREATE INDEX "Topic_categoryId_idx" ON "Topic"("categoryId");
CREATE INDEX "Topic_title_idx" ON "Topic"("title");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
