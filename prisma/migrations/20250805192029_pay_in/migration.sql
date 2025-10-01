-- CreateEnum
CREATE TYPE "PayInType" AS ENUM ('BUY_CREDITS', 'ITEM_CREATE', 'ITEM_UPDATE', 'ZAP', 'DOWN_ZAP', 'BOOST', 'DONATE', 'POLL_VOTE', 'INVITE_GIFT', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE', 'PROXY_PAYMENT', 'REWARDS', 'WITHDRAWAL', 'AUTO_WITHDRAWAL', 'MEDIA_UPLOAD', 'DEFUNCT_TERRITORY_DAILY_PAYOUT');

-- CreateEnum
CREATE TYPE "PayInState" AS ENUM ('PENDING_INVOICE_CREATION', 'PENDING_INVOICE_WRAP', 'PENDING_WITHDRAWAL', 'PENDING', 'PENDING_HELD', 'HELD', 'PAID', 'FAILED', 'FORWARDING', 'FORWARDED', 'FAILED_FORWARD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayInFailureReason" AS ENUM ('INVOICE_CREATION_FAILED', 'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE', 'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY', 'INVOICE_WRAPPING_FAILED_UNKNOWN', 'INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW', 'INVOICE_FORWARDING_FAILED', 'HELD_INVOICE_UNEXPECTED_ERROR', 'HELD_INVOICE_SETTLED_TOO_SLOW', 'WITHDRAWAL_FAILED', 'USER_CANCELLED', 'SYSTEM_CANCELLED', 'INVOICE_EXPIRED', 'EXECUTION_FAILED', 'UNKNOWN_FAILURE');

-- CreateEnum
CREATE TYPE "CustodialTokenType" AS ENUM ('CREDITS', 'SATS');

-- CreateEnum
CREATE TYPE "PayOutType" AS ENUM ('TERRITORY_REVENUE', 'REWARDS_POOL', 'ROUTING_FEE', 'ROUTING_FEE_REFUND', 'PROXY_PAYMENT', 'ZAP', 'REWARD', 'INVITE_GIFT', 'WITHDRAWAL', 'SYSTEM_REVENUE', 'BUY_CREDITS', 'INVOICE_OVERPAY_SPILLOVER', 'DEFUNCT_REFERRAL_ACT');

-- AlterTable
ALTER TABLE "LnWith" ADD COLUMN     "payInId" INTEGER;

-- AlterTable
ALTER TABLE "WalletLog" ADD COLUMN     "payInId" INTEGER;

-- AlterTable
ALTER TABLE "Earn" ADD COLUMN     "payOutCustodialTokenId" INTEGER,
ADD COLUMN     "typeProportion" FLOAT;

-- add user for rewards if they don't exist (for dev)
INSERT INTO users (id, name) VALUES (9513, 'rewards') ON CONFLICT DO NOTHING;

UPDATE "Upload" SET "paid" = false WHERE "paid" IS NULL;

-- AlterTable
ALTER TABLE "Upload" ALTER COLUMN "paid" SET NOT NULL,
ALTER COLUMN "paid" SET DEFAULT false;

-- AlterTable
ALTER TABLE "PollVote" ADD COLUMN     "payInId" INTEGER;

-- CreateTable
CREATE UNLOGGED TABLE "ItemPayIn" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "ItemPayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "SubPayIn" (
    "id" SERIAL NOT NULL,
    "subName" CITEXT NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "SubPayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayIn" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mcost" BIGINT NOT NULL,
    "payInType" "PayInType" NOT NULL,
    "payInState" "PayInState" NOT NULL,
    "payInFailureReason" "PayInFailureReason",
    "payInStateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "genesisId" INTEGER,
    "successorId" INTEGER,
    "benefactorId" INTEGER,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayInCustodialToken" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "mtokens" BIGINT NOT NULL,
    "custodialTokenType" "CustodialTokenType" NOT NULL,
    "mtokensAfter" BIGINT,

    CONSTRAINT "PayInCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PessimisticEnv" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "args" JSONB,
    "error" TEXT,
    "result" JSONB,

    CONSTRAINT "PessimisticEnv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "SubPayOutCustodialToken" (
    "id" SERIAL NOT NULL,
    "subName" CITEXT NOT NULL,
    "payOutCustodialTokenId" INTEGER NOT NULL,

    CONSTRAINT "SubPayOutCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayOutCustodialToken" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payOutType" "PayOutType" NOT NULL,
    "userId" INTEGER,
    "payInId" INTEGER NOT NULL,
    "mtokens" BIGINT NOT NULL,
    "custodialTokenType" "CustodialTokenType" NOT NULL,
    "mtokensAfter" BIGINT,

    CONSTRAINT "PayOutCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayInBolt11" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payInId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "preimage" TEXT,
    "bolt11" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedIndex" BIGINT,
    "cancelledAt" TIMESTAMP(3),
    "msatsRequested" BIGINT NOT NULL,
    "msatsReceived" BIGINT,
    "expiryHeight" INTEGER,
    "acceptHeight" INTEGER,
    "userId" INTEGER NOT NULL,
    "protocolId" INTEGER,

    CONSTRAINT "PayInBolt11_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayOutBolt11" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payOutType" "PayOutType" NOT NULL,
    "userId" INTEGER NOT NULL,
    "hash" TEXT,
    "preimage" TEXT,
    "bolt11" TEXT,
    "msats" BIGINT NOT NULL,
    "status" "WithdrawlStatus",
    "protocolId" INTEGER,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "PayOutBolt11_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayInBolt11Lud18" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "name" TEXT,
    "identifier" TEXT,
    "email" TEXT,
    "pubkey" TEXT,

    CONSTRAINT "PayInBolt11Lud18_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayInBolt11NostrNote" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "note" JSONB NOT NULL,

    CONSTRAINT "PayInBolt11NostrNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "PayInBolt11Comment" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "PayInBolt11Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "RefundCustodialToken" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "mtokens" BIGINT NOT NULL,
    "mtokensAfter" BIGINT,
    "custodialTokenType" "CustodialTokenType" NOT NULL,

    CONSTRAINT "RefundCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "UploadPayIn" (
    "id" SERIAL NOT NULL,
    "uploadId" INTEGER NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "UploadPayIn_pkey" PRIMARY KEY ("id")
);

-- do transformations to unlogged tables

-- create function to determine if credits or sats based on time passed in
CREATE OR REPLACE FUNCTION get_custodial_token_type(created_at TIMESTAMP)
RETURNS "CustodialTokenType" AS $$
BEGIN
    RETURN CASE
        WHEN created_at < '2025-01-03 00:00:00' THEN 'SATS'
        ELSE 'CREDITS'
    END;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- SECTION 1: INVITES
-- Description: Migrate invite gifts to PayIn/PayOut system
-- Estimated rows: SELECT COUNT(*) FROM users WHERE "inviteId" IS NOT NULL
-- Balance: PayIn.mcost = PayInCustodialToken.mtokens = PayOutCustodialToken.mtokens
-- =============================================================================

CREATE TEMP TABLE invite AS
SELECT users.id AS "invitedUserId", users.created_at AS "invitedAt", "Invite".*
FROM users
JOIN "Invite" ON "Invite"."id" = "users"."inviteId"
WHERE users."inviteId" IS NOT NULL;

CREATE INDEX invite_id_idx ON invite (id);
ANALYZE invite;

CREATE TEMP TABLE map_invite_payin (invite_id TEXT, payin_id INTEGER PRIMARY KEY);

-- Generate PayIn IDs and create records
WITH invite_with_payin_ids AS (
    SELECT
        invite.*,
        nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
    FROM invite
), insert_payins AS (
    INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
    SELECT
        payin_id,
        "invitedAt",                    -- created_at
        "invitedAt",                    -- updated_at
        gift * 1000,                    -- mcost (convert sats to msats)
        'INVITE_GIFT',                  -- payInType
        'PAID',                         -- payInState (invites are always paid)
        "invitedAt",                    -- payInStateChangedAt
        "userId"                        -- userId (inviter)
    FROM invite_with_payin_ids
)
-- Store invite->payin mapping for later joins
INSERT INTO map_invite_payin (invite_id, payin_id)
SELECT id, payin_id FROM invite_with_payin_ids;

-- Step 2: Record the funding source (custodial tokens)
-- Token type depends on invite date: SATS before 2025-01-03, CREDITS after
INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
SELECT map_invite_payin.payin_id, gift * 1000, get_custodial_token_type("invitedAt")
FROM invite
JOIN map_invite_payin ON map_invite_payin.invite_id = invite.id;

-- Step 3: Record the payout to invited user
-- Creates balance: PayIn.mcost = PayInCustodialToken.mtokens = PayOutCustodialToken.mtokens
INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
SELECT "invitedAt", "invitedAt", "invitedUserId", map_invite_payin.payin_id, gift * 1000, get_custodial_token_type("invitedAt"), 'INVITE_GIFT'
FROM invite
JOIN map_invite_payin ON map_invite_payin.invite_id = invite.id;

-- Cleanup: Remove temporary tables to free memory
DROP TABLE invite;
DROP TABLE map_invite_payin;

-- =============================================================================
-- SECTION 2: DONATIONS
-- Description: Migrate donations to PayIn/PayOut system
-- Note: Assumes custodial token funding, creates BUY_CREDITS for invoices
-- =============================================================================

-- for donations, we don't know the funding source exactly - it could've been a pessimistic invoice
-- or custodial tokens, so we assume it was custodial tokens, then for those invoices we'll create a
-- BUY_CREDITS payin
WITH donations AS (
    SELECT "Donation".*
    FROM "Donation"
), payins AS (
    INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
    SELECT "created_at", "created_at", "sats" * 1000, 'DONATE', 'PAID', "created_at", "userId"
    FROM donations
    RETURNING "PayIn".*
), payincustodialtokens AS (
    INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
    SELECT id, mcost, get_custodial_token_type("created_at")
    FROM payins
)
INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
SELECT "created_at", "created_at", 9513, id, mcost, 'SATS', 'REWARDS_POOL'
FROM payins;

--------------------
------WITHDRAWLS----
--------------------

-- Batched withdrawal migration to handle large datasets
DO $$
DECLARE
    batch_size INTEGER := 50000;
    offset_val INTEGER := 0;
    rows_processed INTEGER;
    batch_num INTEGER := 1;
    max_id INTEGER;
BEGIN
    -- Get max withdrawal ID for progress tracking
    SELECT COALESCE(MAX("id"), 0) INTO max_id FROM "Withdrawl";
    RAISE LOG 'Processing % total withdrawals in batches of %', max_id, batch_size;

    -- Create persistent temp tables for the entire withdrawal migration
    DROP TABLE IF EXISTS withdrawal_batch;
    DROP TABLE IF EXISTS map_withdrawal_payin_batch;

    CREATE TEMP TABLE withdrawal_batch AS
    SELECT "Withdrawl".* FROM "Withdrawl" WHERE FALSE; -- Empty template

    CREATE TEMP TABLE map_withdrawal_payin_batch (
        withdrawal_id INTEGER PRIMARY KEY,
        payin_id INTEGER NOT NULL
    );

    LOOP
        RAISE LOG 'Processing withdrawal batch % (IDs % to %)', batch_num, offset_val + 1, offset_val + batch_size;

        -- Clear batch table
        TRUNCATE withdrawal_batch;
        TRUNCATE map_withdrawal_payin_batch;

        -- Load next batch
        INSERT INTO withdrawal_batch
        SELECT "Withdrawl".*
        FROM "Withdrawl"
        LEFT JOIN "InvoiceForward" ON "InvoiceForward"."withdrawlId" = "Withdrawl"."id"
        WHERE "InvoiceForward"."withdrawlId" IS NULL
          AND "Withdrawl"."id" > offset_val
        ORDER BY "Withdrawl"."id"
        LIMIT batch_size;

        GET DIAGNOSTICS rows_processed = ROW_COUNT;
        EXIT WHEN rows_processed = 0;

        -- Create indexes for this batch
        DROP INDEX IF EXISTS withdrawal_batch_id_idx;
        CREATE UNIQUE INDEX withdrawal_batch_id_idx ON withdrawal_batch (id);
        ANALYZE withdrawal_batch;

        -- Process PayIn records for this batch
        WITH withdrawal_payin_prospect AS (
            SELECT withdrawal_batch.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
            FROM withdrawal_batch
        ), insert_payin AS (
            INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
            SELECT payin_id, "created_at", "updated_at", "msatsPaying" + "msatsFeePaying",
                CASE WHEN "autoWithdraw" THEN 'AUTO_WITHDRAWAL' ELSE 'WITHDRAWAL' END::"PayInType",
                CASE WHEN "status" = 'CONFIRMED' THEN 'PAID' WHEN "status" IS NULL THEN 'PENDING_WITHDRAWAL' ELSE 'FAILED' END::"PayInState",
                "updated_at", "userId"
            FROM withdrawal_payin_prospect
            RETURNING *
        )
        INSERT INTO map_withdrawal_payin_batch (withdrawal_id, payin_id)
        SELECT id, payin_id FROM withdrawal_payin_prospect;

        -- Insert PayInCustodialToken records for this batch
        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
        SELECT map_withdrawal_payin_batch.payin_id, "msatsPaying" + "msatsFeePaying", 'SATS'
        FROM withdrawal_batch
        JOIN map_withdrawal_payin_batch ON map_withdrawal_payin_batch.withdrawal_id = withdrawal_batch.id;

        -- Insert PayOutBolt11 records for this batch
        INSERT INTO "PayOutBolt11" (created_at, updated_at, "payOutType", "hash", "preimage", "bolt11", "msats", "status", "userId", "payInId", "protocolId")
        SELECT "created_at", "updated_at", 'WITHDRAWAL', "hash", "preimage", "bolt11", COALESCE("msatsPaid", "msatsPaying"), "status", "userId", map_withdrawal_payin_batch.payin_id, "protocolId"
        FROM withdrawal_batch
        JOIN map_withdrawal_payin_batch ON map_withdrawal_payin_batch.withdrawal_id = withdrawal_batch.id;

        -- Insert routing fee PayOutCustodialToken records for this batch
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT "created_at", "updated_at", NULL, map_withdrawal_payin_batch.payin_id, "msatsFeePaying", 'SATS', 'ROUTING_FEE'
        FROM withdrawal_batch
        JOIN map_withdrawal_payin_batch ON map_withdrawal_payin_batch.withdrawal_id = withdrawal_batch.id;

        -- Insert routing fee refund PayOutCustodialToken records for this batch
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT "created_at", "updated_at", "userId", map_withdrawal_payin_batch.payin_id, withdrawal_batch."msatsFeePaying" - withdrawal_batch."msatsFeePaid", 'SATS', 'ROUTING_FEE_REFUND'
        FROM withdrawal_batch
        JOIN map_withdrawal_payin_batch ON map_withdrawal_payin_batch.withdrawal_id = withdrawal_batch.id
        WHERE "status" = 'CONFIRMED' AND "msatsFeePaid" < "msatsFeePaying";

        -- Update offset for next batch
        SELECT MAX(id) INTO offset_val FROM withdrawal_batch;
        batch_num := batch_num + 1;
    END LOOP;

    -- Clean up
    DROP TABLE IF EXISTS withdrawal_batch;
    DROP TABLE IF EXISTS map_withdrawal_payin_batch;

    RAISE LOG 'Completed withdrawal migration in % batches', batch_num - 1;
END $$;


-- begin logging the tables
ALTER TABLE "ItemPayIn" SET LOGGED;
ALTER TABLE "SubPayIn" SET LOGGED;
ALTER TABLE "PayIn" SET LOGGED;
ALTER TABLE "PayInCustodialToken" SET LOGGED;
ALTER TABLE "PessimisticEnv" SET LOGGED;
ALTER TABLE "SubPayOutCustodialToken" SET LOGGED;
ALTER TABLE "PayOutCustodialToken" SET LOGGED;
ALTER TABLE "PayInBolt11" SET LOGGED;
ALTER TABLE "PayOutBolt11" SET LOGGED;
ALTER TABLE "PayInBolt11Lud18" SET LOGGED;
ALTER TABLE "PayInBolt11NostrNote" SET LOGGED;
ALTER TABLE "PayInBolt11Comment" SET LOGGED;
ALTER TABLE "RefundCustodialToken" SET LOGGED;
ALTER TABLE "UploadPayIn" SET LOGGED;