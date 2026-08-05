-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "identityId" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
