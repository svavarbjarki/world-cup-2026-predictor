-- AlterTable
ALTER TABLE "User" ADD COLUMN "resumeCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_resumeCode_key" ON "User"("resumeCode");
