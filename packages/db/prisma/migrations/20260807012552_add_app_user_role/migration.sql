-- CreateEnum
CREATE TYPE "AppUserRole" AS ENUM ('admin', 'member');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "role" "AppUserRole" NOT NULL DEFAULT 'member';

-- Backfill: every AppUser row that already exists at this point was
-- provisioned before the app had any role concept, back when signing
-- in at all meant full access — grandfather them all to admin so this
-- migration can't silently downgrade an existing admin-provisioned
-- account to member. Only rows created AFTER this migration get the
-- column's new "member" default (or whatever the creation form's
-- admin explicitly picks).
UPDATE "AppUser" SET "role" = 'admin';
