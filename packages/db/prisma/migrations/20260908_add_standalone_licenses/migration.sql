-- CreateTable
CREATE TABLE "StandaloneLicense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "machineFingerprint" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "signedLicenseJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "issuedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandaloneLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandaloneLicense_licenseId_key" ON "StandaloneLicense"("licenseId");

-- CreateIndex
CREATE INDEX "StandaloneLicense_tenantId_idx" ON "StandaloneLicense"("tenantId");

-- CreateIndex
CREATE INDEX "StandaloneLicense_machineFingerprint_idx" ON "StandaloneLicense"("machineFingerprint");

-- AddForeignKey
ALTER TABLE "StandaloneLicense" ADD CONSTRAINT "StandaloneLicense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
