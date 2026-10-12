-- CreateTable
CREATE TABLE "WeeklyPlayerStat" (
    "id" TEXT NOT NULL,
    "sleeperPlayerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerPosition" TEXT NOT NULL,
    "nflTeam" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "snapPct" DOUBLE PRECISION,
    "offSnaps" INTEGER,
    "teamOffSnaps" INTEGER,
    "carries" INTEGER,
    "rushYards" INTEGER,
    "rushTd" INTEGER,
    "targets" INTEGER,
    "receptions" INTEGER,
    "recYards" INTEGER,
    "recTd" INTEGER,
    "recAirYards" INTEGER,
    "targetSharePct" DOUBLE PRECISION,
    "passAttempts" INTEGER,
    "passCompletions" INTEGER,
    "passYards" INTEGER,
    "passTd" INTEGER,
    "interceptions" INTEGER,
    "fantasyPoints" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyPlayerStat_nflTeam_season_week_idx" ON "WeeklyPlayerStat"("nflTeam", "season", "week");

-- CreateIndex
CREATE INDEX "WeeklyPlayerStat_playerPosition_season_week_idx" ON "WeeklyPlayerStat"("playerPosition", "season", "week");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlayerStat_sleeperPlayerId_season_week_key" ON "WeeklyPlayerStat"("sleeperPlayerId", "season", "week");
