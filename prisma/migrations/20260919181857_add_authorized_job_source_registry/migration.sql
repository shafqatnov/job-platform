-- CreateEnum
CREATE TYPE "JobSourceType" AS ENUM ('API', 'FEED', 'ATS', 'OFFICIAL_CAREER_SOURCE');

-- CreateTable
CREATE TABLE "AuthorizedJobSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "JobSourceType" NOT NULL,
    "baseEndpoint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT true,
    "refreshIntervalMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'not_configured',
    "credentialEnvVarName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizedJobSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizedJobSource_name_key" ON "AuthorizedJobSource"("name");
