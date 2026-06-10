-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "isoCode" TEXT NOT NULL,
    "pot" INTEGER NOT NULL
);

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
CREATE TABLE "GroupFixture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchNumber" INTEGER NOT NULL,
    "group" TEXT NOT NULL,
    "matchday" INTEGER NOT NULL,
    "kickoffAt" DATETIME,
    "venue" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    CONSTRAINT "GroupFixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupFixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnockoutFixture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchNumber" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "kickoffAt" DATETIME,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnockoutFixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnockoutFixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
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

-- CreateTable
CREATE TABLE "GroupPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "groupFixtureId" TEXT NOT NULL,
    "homeGoals" INTEGER NOT NULL,
    "awayGoals" INTEGER NOT NULL,
    CONSTRAINT "GroupPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupPrediction_groupFixtureId_fkey" FOREIGN KEY ("groupFixtureId") REFERENCES "GroupFixture" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnockoutPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "predictedWinnerTeamId" TEXT NOT NULL,
    CONSTRAINT "KnockoutPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnockoutPrediction_predictedWinnerTeamId_fkey" FOREIGN KEY ("predictedWinnerTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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

-- CreateTable
CREATE TABLE "GroupResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupFixtureId" TEXT NOT NULL,
    "homeGoals" INTEGER NOT NULL,
    "awayGoals" INTEGER NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupResult_groupFixtureId_fkey" FOREIGN KEY ("groupFixtureId") REFERENCES "GroupFixture" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnockoutResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchNumber" INTEGER NOT NULL,
    "round" TEXT NOT NULL,
    "actualWinnerTeamId" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnockoutResult_actualWinnerTeamId_fkey" FOREIGN KEY ("actualWinnerTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
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

-- CreateIndex
CREATE INDEX "Team_group_idx" ON "Team"("group");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_teamId_key" ON "Player"("name", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupFixture_matchNumber_key" ON "GroupFixture"("matchNumber");

-- CreateIndex
CREATE INDEX "GroupFixture_group_idx" ON "GroupFixture"("group");

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutFixture_matchNumber_key" ON "KnockoutFixture"("matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutFixture_slot_key" ON "KnockoutFixture"("slot");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");

-- CreateIndex
CREATE INDEX "GroupPrediction_userId_idx" ON "GroupPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPrediction_userId_groupFixtureId_key" ON "GroupPrediction"("userId", "groupFixtureId");

-- CreateIndex
CREATE INDEX "KnockoutPrediction_userId_idx" ON "KnockoutPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutPrediction_userId_matchNumber_key" ON "KnockoutPrediction"("userId", "matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AwardPrediction_userId_key" ON "AwardPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupResult_groupFixtureId_key" ON "GroupResult"("groupFixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutResult_matchNumber_key" ON "KnockoutResult"("matchNumber");
