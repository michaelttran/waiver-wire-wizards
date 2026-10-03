-- CreateTable
CREATE TABLE "PageVisit" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageVisit_createdAt_idx" ON "PageVisit"("createdAt");

-- CreateIndex
CREATE INDEX "PageVisit_ip_createdAt_idx" ON "PageVisit"("ip", "createdAt");
