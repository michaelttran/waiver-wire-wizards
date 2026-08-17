-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "faabStarting" INTEGER NOT NULL DEFAULT 100,
    "buyInPaid" BOOLEAN NOT NULL DEFAULT false,
    "playoffPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FaabTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FaabTransaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "winnerId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyChallenge_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "draftOrderNote" TEXT NOT NULL DEFAULT 'Draft order will be posted here once it''s set.'
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyChallenge_week_key" ON "WeeklyChallenge"("week");
