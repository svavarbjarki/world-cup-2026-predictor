-- CreateTable
CREATE TABLE "BonusPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "line" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BonusPredictionPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bonusPredictionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BonusPredictionPick_bonusPredictionId_fkey" FOREIGN KEY ("bonusPredictionId") REFERENCES "BonusPrediction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BonusPredictionPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "groupExactPoints" INTEGER NOT NULL DEFAULT 3,
    "groupResultPoints" INTEGER NOT NULL DEFAULT 1,
    "groupWrongPoints" INTEGER NOT NULL DEFAULT 0,
    "knockoutCorrectPoints" INTEGER NOT NULL DEFAULT 3,
    "knockoutWrongPoints" INTEGER NOT NULL DEFAULT 0,
    "awardPoints" INTEGER NOT NULL DEFAULT 5,
    "bonusOverUnderLine" REAL NOT NULL DEFAULT 2.5,
    "bonusPointsPerCorrect" INTEGER NOT NULL DEFAULT 1,
    "kickoffLockAt" DATETIME,
    "knockoutOpenedAt" DATETIME,
    "knockoutLockAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("awardPoints", "groupExactPoints", "groupResultPoints", "groupWrongPoints", "id", "kickoffLockAt", "knockoutCorrectPoints", "knockoutLockAt", "knockoutOpenedAt", "knockoutWrongPoints", "updatedAt") SELECT "awardPoints", "groupExactPoints", "groupResultPoints", "groupWrongPoints", "id", "kickoffLockAt", "knockoutCorrectPoints", "knockoutLockAt", "knockoutOpenedAt", "knockoutWrongPoints", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BonusPrediction_matchNumber_key" ON "BonusPrediction"("matchNumber");

-- CreateIndex
CREATE INDEX "BonusPredictionPick_bonusPredictionId_idx" ON "BonusPredictionPick"("bonusPredictionId");

-- CreateIndex
CREATE INDEX "BonusPredictionPick_userId_idx" ON "BonusPredictionPick"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BonusPredictionPick_userId_bonusPredictionId_key" ON "BonusPredictionPick"("userId", "bonusPredictionId");

