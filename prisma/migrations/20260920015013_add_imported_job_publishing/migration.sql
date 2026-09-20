-- CreateEnum
CREATE TYPE "ImportedJobReviewStatus" AS ENUM ('pending', 'published', 'rejected');

-- AlterEnum
ALTER TYPE "JobSource" ADD VALUE 'imported';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "importedExternalJobId" TEXT,
ADD COLUMN     "importedSourceId" TEXT,
ADD COLUMN     "importedSourceUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ImportedJobReview" (
    "id" TEXT NOT NULL,
    "importedSourceId" TEXT NOT NULL,
    "importedExternalJobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "companyIdentity" TEXT,
    "location" TEXT,
    "sourceUrl" TEXT,
    "category" TEXT,
    "country" TEXT,
    "city" TEXT,
    "decision" TEXT NOT NULL,
    "reasons" TEXT[],
    "status" "ImportedJobReviewStatus" NOT NULL DEFAULT 'pending',
    "publishedJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedJobReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedJobReview_publishedJobId_key" ON "ImportedJobReview"("publishedJobId");

-- CreateIndex
CREATE INDEX "ImportedJobReview_importedSourceId_importedExternalJobId_idx" ON "ImportedJobReview"("importedSourceId", "importedExternalJobId");

-- CreateIndex
CREATE INDEX "ImportedJobReview_status_idx" ON "ImportedJobReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Job_importedSourceId_importedExternalJobId_key" ON "Job"("importedSourceId", "importedExternalJobId");

-- AddForeignKey
ALTER TABLE "ImportedJobReview" ADD CONSTRAINT "ImportedJobReview_publishedJobId_fkey" FOREIGN KEY ("publishedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

