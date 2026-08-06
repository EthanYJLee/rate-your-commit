-- CreateTable
CREATE TABLE "IdentityAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "personId" TEXT,
    "previousPersonId" TEXT,
    "actorLogin" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IdentityAuditLog" ADD CONSTRAINT "IdentityAuditLog_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityAuditLog" ADD CONSTRAINT "IdentityAuditLog_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
