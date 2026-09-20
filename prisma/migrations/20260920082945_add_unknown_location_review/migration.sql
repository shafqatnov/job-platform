-- CreateEnum
CREATE TYPE "LocationReviewStatus" AS ENUM ('pending', 'resolved', 'rejected');

-- AlterTable
ALTER TABLE "ImportedJobReview" ADD COLUMN     "locationReviewStatus" "LocationReviewStatus",
ADD COLUMN     "locationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedCityId" TEXT,
ADD COLUMN     "resolvedCountryId" TEXT;

-- CreateTable
CREATE TABLE "ResolvedLocationAlias" (
    "id" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "cityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolvedLocationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResolvedLocationAlias_normalizedAlias_key" ON "ResolvedLocationAlias"("normalizedAlias");

-- CreateIndex
CREATE INDEX "ImportedJobReview_locationReviewStatus_idx" ON "ImportedJobReview"("locationReviewStatus");

-- AddForeignKey
ALTER TABLE "ImportedJobReview" ADD CONSTRAINT "ImportedJobReview_resolvedCountryId_fkey" FOREIGN KEY ("resolvedCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedJobReview" ADD CONSTRAINT "ImportedJobReview_resolvedCityId_fkey" FOREIGN KEY ("resolvedCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolvedLocationAlias" ADD CONSTRAINT "ResolvedLocationAlias_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolvedLocationAlias" ADD CONSTRAINT "ResolvedLocationAlias_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

