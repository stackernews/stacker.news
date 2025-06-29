-- CreateEnum
CREATE TYPE "OAuthGrantType" AS ENUM ('authorization_code', 'refresh_token', 'client_credentials');

-- CreateEnum
CREATE TYPE "OAuthScope" AS ENUM (
  'read',
  'wallet:read',
  'wallet:send',
  'wallet:receive',
  'profile:read'
);

-- CreateEnum
CREATE TYPE "OAuthTokenType" AS ENUM ('bearer');

-- CreateTable
CREATE TABLE "OAuthApplication" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "homepage_url" TEXT,
    "privacy_policy_url" TEXT,
    "terms_of_service_url" TEXT,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "scopes" "OAuthScope"[],
    "logo_url" TEXT,
    "is_confidential" BOOLEAN NOT NULL DEFAULT true,
    "pkce_required" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspended_reason" TEXT,
    "rate_limit_rpm" INTEGER DEFAULT 100,
    "rate_limit_daily" INTEGER DEFAULT 5000,

    CONSTRAINT "OAuthApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationCode" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" "OAuthScope"[],
    "code_challenge" TEXT,
    "code_challenge_method" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccessToken" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "scopes" "OAuthScope"[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "last_used_ip" TEXT,

    CONSTRAINT "OAuthAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthRefreshToken" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "access_token_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "OAuthRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationGrant" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "scopes" "OAuthScope"[],
    "authorized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "OAuthAuthorizationGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthWalletTransaction" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "access_token_id" INTEGER NOT NULL,
    "bolt11" TEXT NOT NULL,
    "amount_msats" BIGINT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved" BOOLEAN,
    "approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invoice_id" INTEGER,
    "withdrawal_id" INTEGER,

    CONSTRAINT "OAuthWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthApiUsage" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "application_id" INTEGER NOT NULL,
    "access_token_id" INTEGER,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_time_ms" INTEGER,
    "user_id" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "OAuthApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_client_id_key" ON "OAuthApplication"("client_id");

-- CreateIndex
CREATE INDEX "OAuthApplication_user_id_idx" ON "OAuthApplication"("user_id");

-- CreateIndex
CREATE INDEX "OAuthApplication_approved_idx" ON "OAuthApplication"("approved");

-- CreateIndex
CREATE INDEX "OAuthApplication_suspended_idx" ON "OAuthApplication"("suspended");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationCode_code_key" ON "OAuthAuthorizationCode"("code");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationCode_user_id_idx" ON "OAuthAuthorizationCode"("user_id");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationCode_application_id_idx" ON "OAuthAuthorizationCode"("application_id");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationCode_expires_at_idx" ON "OAuthAuthorizationCode"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccessToken_token_key" ON "OAuthAccessToken"("token");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_user_id_idx" ON "OAuthAccessToken"("user_id");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_application_id_idx" ON "OAuthAccessToken"("application_id");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_expires_at_idx" ON "OAuthAccessToken"("expires_at");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_revoked_idx" ON "OAuthAccessToken"("revoked");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthRefreshToken_token_key" ON "OAuthRefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthRefreshToken_access_token_id_key" ON "OAuthRefreshToken"("access_token_id");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_user_id_idx" ON "OAuthRefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_application_id_idx" ON "OAuthRefreshToken"("application_id");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_expires_at_idx" ON "OAuthRefreshToken"("expires_at");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_revoked_idx" ON "OAuthRefreshToken"("revoked");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationGrant_user_id_application_id_key" ON "OAuthAuthorizationGrant"("user_id", "application_id");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationGrant_application_id_idx" ON "OAuthAuthorizationGrant"("application_id");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationGrant_revoked_idx" ON "OAuthAuthorizationGrant"("revoked");

-- CreateIndex
CREATE INDEX "OAuthWalletTransaction_user_id_idx" ON "OAuthWalletTransaction"("user_id");

-- CreateIndex
CREATE INDEX "OAuthWalletTransaction_application_id_idx" ON "OAuthWalletTransaction"("application_id");

-- CreateIndex
CREATE INDEX "OAuthWalletTransaction_access_token_id_idx" ON "OAuthWalletTransaction"("access_token_id");

-- CreateIndex
CREATE INDEX "OAuthWalletTransaction_status_idx" ON "OAuthWalletTransaction"("status");

-- CreateIndex
CREATE INDEX "OAuthWalletTransaction_expires_at_idx" ON "OAuthWalletTransaction"("expires_at");

-- CreateIndex
CREATE INDEX "OAuthApiUsage_application_id_idx" ON "OAuthApiUsage"("application_id");

-- CreateIndex
CREATE INDEX "OAuthApiUsage_access_token_id_idx" ON "OAuthApiUsage"("access_token_id");

-- CreateIndex
CREATE INDEX "OAuthApiUsage_created_at_idx" ON "OAuthApiUsage"("created_at");

-- CreateIndex
CREATE INDEX "OAuthApiUsage_user_id_idx" ON "OAuthApiUsage"("user_id");

-- AddForeignKey
ALTER TABLE "OAuthApplication" ADD CONSTRAINT "OAuthApplication_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationCode" ADD CONSTRAINT "OAuthAuthorizationCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationCode" ADD CONSTRAINT "OAuthAuthorizationCode_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccessToken" ADD CONSTRAINT "OAuthAccessToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccessToken" ADD CONSTRAINT "OAuthAccessToken_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_access_token_id_fkey" FOREIGN KEY ("access_token_id") REFERENCES "OAuthAccessToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationGrant" ADD CONSTRAINT "OAuthAuthorizationGrant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationGrant" ADD CONSTRAINT "OAuthAuthorizationGrant_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthWalletTransaction" ADD CONSTRAINT "OAuthWalletTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthWalletTransaction" ADD CONSTRAINT "OAuthWalletTransaction_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthWalletTransaction" ADD CONSTRAINT "OAuthWalletTransaction_access_token_id_fkey" FOREIGN KEY ("access_token_id") REFERENCES "OAuthAccessToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthWalletTransaction" ADD CONSTRAINT "OAuthWalletTransaction_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthWalletTransaction" ADD CONSTRAINT "OAuthWalletTransaction_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "Withdrawl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApiUsage" ADD CONSTRAINT "OAuthApiUsage_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApiUsage" ADD CONSTRAINT "OAuthApiUsage_access_token_id_fkey" FOREIGN KEY ("access_token_id") REFERENCES "OAuthAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApiUsage" ADD CONSTRAINT "OAuthApiUsage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
