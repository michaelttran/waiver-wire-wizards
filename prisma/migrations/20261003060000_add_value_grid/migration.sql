-- AlterTable
ALTER TABLE "DraftPick" ADD COLUMN     "sleeperPlayerId" TEXT;

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "adpSnapshotAt" TIMESTAMP(3),
ADD COLUMN     "adpSnapshotNote" TEXT,
ADD COLUMN     "statsThroughWeek" INTEGER;

-- CreateTable
CREATE TABLE "AdpEntry" (
    "id" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "adp" DOUBLE PRECISION NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerPosition" TEXT NOT NULL,
    "nflTeam" TEXT,
    "sleeperPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdpEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeasonPoints" (
    "sleeperPlayerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerPosition" TEXT NOT NULL,
    "nflTeam" TEXT,
    "points" DOUBLE PRECISION NOT NULL,
    "gamesPlayed" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonPoints_pkey" PRIMARY KEY ("sleeperPlayerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdpEntry_overall_key" ON "AdpEntry"("overall");

