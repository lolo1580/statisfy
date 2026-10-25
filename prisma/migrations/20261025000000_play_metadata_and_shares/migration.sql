-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileShareConfig" TEXT,
ADD COLUMN     "profileShareToken" TEXT,
ADD COLUMN     "statsApiToken" TEXT;

-- AlterTable
ALTER TABLE "Play" ADD COLUMN     "country" TEXT,
ADD COLUMN     "incognito" BOOLEAN,
ADD COLUMN     "offline" BOOLEAN,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "reasonEnd" TEXT,
ADD COLUMN     "reasonStart" TEXT,
ADD COLUMN     "shuffle" BOOLEAN,
ADD COLUMN     "skipped" BOOLEAN;

-- CreateIndex
CREATE INDEX "User_statsApiToken_idx" ON "User"("statsApiToken");

-- CreateIndex
CREATE INDEX "User_profileShareToken_idx" ON "User"("profileShareToken");

