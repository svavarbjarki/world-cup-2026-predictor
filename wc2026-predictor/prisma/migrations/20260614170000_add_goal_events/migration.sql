-- AlterTable
ALTER TABLE "KnockoutResult" ADD COLUMN "awayGoals" INTEGER;
ALTER TABLE "KnockoutResult" ADD COLUMN "homeGoals" INTEGER;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "apiFootballId" INTEGER;
ALTER TABLE "Player" ADD COLUMN "number" INTEGER;
ALTER TABLE "Player" ADD COLUMN "photo" TEXT;

-- CreateTable
CREATE TABLE "GoalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupResultId" TEXT,
    "knockoutResultId" TEXT,
    "scorerId" TEXT,
    "assisterId" TEXT,
    "minute" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoalEvent_groupResultId_fkey" FOREIGN KEY ("groupResultId") REFERENCES "GroupResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoalEvent_knockoutResultId_fkey" FOREIGN KEY ("knockoutResultId") REFERENCES "KnockoutResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoalEvent_scorerId_fkey" FOREIGN KEY ("scorerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GoalEvent_assisterId_fkey" FOREIGN KEY ("assisterId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GoalEvent_groupResultId_idx" ON "GoalEvent"("groupResultId");

-- CreateIndex
CREATE INDEX "GoalEvent_knockoutResultId_idx" ON "GoalEvent"("knockoutResultId");

-- CreateIndex
CREATE INDEX "GoalEvent_scorerId_idx" ON "GoalEvent"("scorerId");

-- CreateIndex
CREATE INDEX "GoalEvent_assisterId_idx" ON "GoalEvent"("assisterId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_apiFootballId_key" ON "Player"("apiFootballId");

