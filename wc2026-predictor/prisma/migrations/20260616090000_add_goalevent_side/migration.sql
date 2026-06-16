-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GoalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupResultId" TEXT,
    "knockoutResultId" TEXT,
    "side" TEXT NOT NULL,
    "scorerId" TEXT,
    "assisterId" TEXT,
    "minute" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoalEvent_groupResultId_fkey" FOREIGN KEY ("groupResultId") REFERENCES "GroupResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoalEvent_knockoutResultId_fkey" FOREIGN KEY ("knockoutResultId") REFERENCES "KnockoutResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoalEvent_scorerId_fkey" FOREIGN KEY ("scorerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GoalEvent_assisterId_fkey" FOREIGN KEY ("assisterId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GoalEvent" ("assisterId", "createdAt", "groupResultId", "id", "knockoutResultId", "minute", "scorerId") SELECT "assisterId", "createdAt", "groupResultId", "id", "knockoutResultId", "minute", "scorerId" FROM "GoalEvent";
DROP TABLE "GoalEvent";
ALTER TABLE "new_GoalEvent" RENAME TO "GoalEvent";
CREATE INDEX "GoalEvent_groupResultId_idx" ON "GoalEvent"("groupResultId");
CREATE INDEX "GoalEvent_knockoutResultId_idx" ON "GoalEvent"("knockoutResultId");
CREATE INDEX "GoalEvent_scorerId_idx" ON "GoalEvent"("scorerId");
CREATE INDEX "GoalEvent_assisterId_idx" ON "GoalEvent"("assisterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

