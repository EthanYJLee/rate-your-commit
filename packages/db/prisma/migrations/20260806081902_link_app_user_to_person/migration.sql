-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "personId" TEXT;

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
