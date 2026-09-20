-- CreateEnum
CREATE TYPE "JobSourceAuthorizationStatus" AS ENUM ('unverified', 'verified');

-- AlterTable
ALTER TABLE "AuthorizedJobSource" ADD COLUMN     "authorizationReference" TEXT,
ADD COLUMN     "authorizationStatus" "JobSourceAuthorizationStatus" NOT NULL DEFAULT 'unverified',
ADD COLUMN     "authorizationVerifiedAt" TIMESTAMP(3);

