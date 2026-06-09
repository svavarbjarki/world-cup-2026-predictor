-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "birthYear" INTEGER,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AwardPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "winnerTeamId" TEXT,
    "goldenBallPlayerId" TEXT,
    "goldenBootPlayerId" TEXT,
    "goldenGlovePlayerId" TEXT,
    "youngPlayerId" TEXT,
    CONSTRAINT "AwardPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AwardResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "winnerTeamId" TEXT,
    "goldenBallPlayerId" TEXT,
    "goldenBootPlayerId" TEXT,
    "goldenGlovePlayerId" TEXT,
    "youngPlayerId" TEXT,
    "updatedAt" DATETIME NOT NULL
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
    "kickoffLockAt" DATETIME,
    "knockoutOpenedAt" DATETIME,
    "knockoutLockAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("groupExactPoints", "groupResultPoints", "groupWrongPoints", "id", "kickoffLockAt", "knockoutCorrectPoints", "knockoutLockAt", "knockoutOpenedAt", "knockoutWrongPoints", "updatedAt") SELECT "groupExactPoints", "groupResultPoints", "groupWrongPoints", "id", "kickoffLockAt", "knockoutCorrectPoints", "knockoutLockAt", "knockoutOpenedAt", "knockoutWrongPoints", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "groupsLockedAt" DATETIME,
    "knockoutStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "knockoutSubmittedAt" DATETIME,
    "awardsStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "awardsSubmittedAt" DATETIME,
    "sessionToken" TEXT
);
INSERT INTO "new_User" ("createdAt", "displayName", "groupStatus", "groupsLockedAt", "id", "knockoutStatus", "knockoutSubmittedAt", "sessionToken") SELECT "createdAt", "displayName", "groupStatus", "groupsLockedAt", "id", "knockoutStatus", "knockoutSubmittedAt", "sessionToken" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_teamId_key" ON "Player"("name", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AwardPrediction_userId_key" ON "AwardPrediction"("userId");
