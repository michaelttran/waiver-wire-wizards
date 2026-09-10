-- CreateTable
CREATE TABLE "RosterPlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sleeperPlayerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerPosition" TEXT NOT NULL,
    "nflTeam" TEXT,
    "slot" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RosterPlayer_teamId_sleeperPlayerId_key" ON "RosterPlayer"("teamId", "sleeperPlayerId");

-- AddForeignKey
ALTER TABLE "RosterPlayer" ADD CONSTRAINT "RosterPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
