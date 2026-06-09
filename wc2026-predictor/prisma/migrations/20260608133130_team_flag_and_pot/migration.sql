/*
  Warnings:

  - Added the required column `isoCode` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pot` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "isoCode" TEXT NOT NULL,
    "pot" INTEGER NOT NULL
);
INSERT INTO "new_Team" ("group", "id", "name", "seed") SELECT "group", "id", "name", "seed" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE INDEX "Team_group_idx" ON "Team"("group");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
