/*
  Warnings:

  - You are about to drop the column `status` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `submittedAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "knockoutLockAt" DATETIME;
ALTER TABLE "Settings" ADD COLUMN "knockoutOpenedAt" DATETIME;

-- CreateTable
CREATE TABLE "KnockoutFixture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchNumber" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnockoutFixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnockoutFixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "groupsLockedAt" DATETIME,
    "knockoutStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "knockoutSubmittedAt" DATETIME,
    "sessionToken" TEXT
);
INSERT INTO "new_User" ("createdAt", "displayName", "groupsLockedAt", "id", "sessionToken") SELECT "createdAt", "displayName", "groupsLockedAt", "id", "sessionToken" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutFixture_matchNumber_key" ON "KnockoutFixture"("matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutFixture_slot_key" ON "KnockoutFixture"("slot");
