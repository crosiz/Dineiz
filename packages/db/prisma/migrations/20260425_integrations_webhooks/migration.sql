-- Integrations: aggregator events, Zapier subscriptions, ERP sync config (Task 85+86+87)

-- Enums
DO $$ BEGIN
  CREATE TYPE "AggregatorProvider" AS ENUM ('foodpanda', 'careem');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ErpProvider" AS ENUM ('ERPNEXT', 'QUICKBOOKS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "AggregatorWebhookEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "AggregatorProvider" NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "processError" TEXT,
  CONSTRAINT "AggregatorWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AggregatorWebhookEvent_tenantId_idx" ON "AggregatorWebhookEvent"("tenantId");
CREATE INDEX IF NOT EXISTS "AggregatorWebhookEvent_provider_idx" ON "AggregatorWebhookEvent"("provider");
CREATE INDEX IF NOT EXISTS "AggregatorWebhookEvent_event_idx" ON "AggregatorWebhookEvent"("event");
CREATE INDEX IF NOT EXISTS "AggregatorWebhookEvent_receivedAt_idx" ON "AggregatorWebhookEvent"("receivedAt");

DO $$ BEGIN
  ALTER TABLE "AggregatorWebhookEvent"
  ADD CONSTRAINT "AggregatorWebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ZapierWebhookSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastStatus" "WebhookDeliveryStatus",
  "lastError" TEXT,
  "lastDeliveredAt" TIMESTAMP(3),
  CONSTRAINT "ZapierWebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ZapierWebhookSubscription_tenantId_idx" ON "ZapierWebhookSubscription"("tenantId");
CREATE INDEX IF NOT EXISTS "ZapierWebhookSubscription_event_idx" ON "ZapierWebhookSubscription"("event");
CREATE INDEX IF NOT EXISTS "ZapierWebhookSubscription_isActive_idx" ON "ZapierWebhookSubscription"("isActive");

DO $$ BEGIN
  ALTER TABLE "ZapierWebhookSubscription"
  ADD CONSTRAINT "ZapierWebhookSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ErpIntegration" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "ErpProvider" NOT NULL,
  "baseUrl" TEXT,
  "apiKey" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  CONSTRAINT "ErpIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ErpIntegration_tenantId_key" ON "ErpIntegration"("tenantId");
CREATE INDEX IF NOT EXISTS "ErpIntegration_enabled_idx" ON "ErpIntegration"("enabled");
CREATE INDEX IF NOT EXISTS "ErpIntegration_provider_idx" ON "ErpIntegration"("provider");

DO $$ BEGIN
  ALTER TABLE "ErpIntegration"
  ADD CONSTRAINT "ErpIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

