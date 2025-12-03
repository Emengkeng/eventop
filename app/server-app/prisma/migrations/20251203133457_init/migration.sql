-- CreateTable
CREATE TABLE "indexer_state" (
    "key" TEXT NOT NULL,
    "last_processed_slot" BIGINT NOT NULL,
    "last_sync_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "merchants" (
    "wallet_address" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT,
    "logo_url" TEXT,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("wallet_address")
);

-- CreateTable
CREATE TABLE "merchant_plans" (
    "plan_pda" TEXT NOT NULL,
    "merchant_wallet" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "fee_amount" TEXT NOT NULL,
    "payment_interval" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_subscribers" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" TEXT NOT NULL DEFAULT '0',
    "description" TEXT,
    "features" JSONB,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_plans_pkey" PRIMARY KEY ("plan_pda")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "subscription_pda" TEXT NOT NULL,
    "user_wallet" TEXT NOT NULL,
    "subscription_wallet_pda" TEXT NOT NULL,
    "merchant_wallet" TEXT NOT NULL,
    "merchant_plan_pda" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "fee_amount" TEXT NOT NULL,
    "payment_interval" TEXT NOT NULL,
    "last_payment_timestamp" TEXT NOT NULL,
    "total_paid" TEXT NOT NULL DEFAULT '0',
    "payment_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("subscription_pda")
);

-- CreateTable
CREATE TABLE "subscription_wallets" (
    "wallet_pda" TEXT NOT NULL,
    "owner_wallet" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "is_yield_enabled" BOOLEAN NOT NULL DEFAULT false,
    "yield_strategy" TEXT,
    "yield_vault" TEXT,
    "total_subscriptions" INTEGER NOT NULL DEFAULT 0,
    "total_spent" TEXT NOT NULL DEFAULT '0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_wallets_pkey" PRIMARY KEY ("wallet_pda")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "subscription_pda" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "from_wallet" TEXT NOT NULL,
    "to_wallet" TEXT NOT NULL,
    "block_time" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_payments" (
    "id" TEXT NOT NULL,
    "subscription_pda" TEXT NOT NULL,
    "merchant_wallet" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signature" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),

    CONSTRAINT "scheduled_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "wallet_address" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notification_preferences" JSONB,
    "push_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("wallet_address")
);

-- CreateIndex
CREATE INDEX "merchant_plans_merchant_wallet_idx" ON "merchant_plans"("merchant_wallet");

-- CreateIndex
CREATE INDEX "subscriptions_user_wallet_idx" ON "subscriptions"("user_wallet");

-- CreateIndex
CREATE INDEX "subscriptions_merchant_wallet_idx" ON "subscriptions"("merchant_wallet");

-- CreateIndex
CREATE INDEX "subscriptions_subscription_wallet_pda_idx" ON "subscriptions"("subscription_wallet_pda");

-- CreateIndex
CREATE INDEX "subscription_wallets_owner_wallet_idx" ON "subscription_wallets"("owner_wallet");

-- CreateIndex
CREATE INDEX "transactions_subscription_pda_idx" ON "transactions"("subscription_pda");

-- CreateIndex
CREATE INDEX "transactions_signature_idx" ON "transactions"("signature");

-- CreateIndex
CREATE INDEX "scheduled_payments_subscription_pda_idx" ON "scheduled_payments"("subscription_pda");

-- CreateIndex
CREATE INDEX "scheduled_payments_scheduled_for_idx" ON "scheduled_payments"("scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_payments_status_idx" ON "scheduled_payments"("status");

-- AddForeignKey
ALTER TABLE "merchant_plans" ADD CONSTRAINT "merchant_plans_merchant_wallet_fkey" FOREIGN KEY ("merchant_wallet") REFERENCES "merchants"("wallet_address") ON DELETE RESTRICT ON UPDATE CASCADE;
