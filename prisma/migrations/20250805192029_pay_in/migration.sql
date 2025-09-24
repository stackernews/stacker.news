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

-- CreateTable
CREATE TABLE "ItemPayIn" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "ItemPayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubPayIn" (
    "id" SERIAL NOT NULL,
    "subName" CITEXT NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "SubPayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayIn" (
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

ALTER TABLE "PayIn" ADD CONSTRAINT "mcost_positive" CHECK ("mcost" >= 0) NOT VALID;

CREATE OR REPLACE FUNCTION "PayIn_payInStateChangedAt"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."payInStateChangedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER "PayIn_payInStateChangedAt"
BEFORE UPDATE ON "PayIn"
FOR EACH ROW
WHEN (OLD."payInState" <> NEW."payInState")
EXECUTE FUNCTION "PayIn_payInStateChangedAt"();

CREATE OR REPLACE FUNCTION "PayIn_payInFailureReason"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."payInFailureReason" = CASE
        WHEN NEW."payInFailureReason" IS NULL THEN 'UNKNOWN_FAILURE'
        ELSE NEW."payInFailureReason"
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER "PayIn_payInFailureReason"
AFTER UPDATE ON "PayIn"
FOR EACH ROW
WHEN (NEW."payInState" = 'FAILED')
EXECUTE FUNCTION "PayIn_payInFailureReason"();

-- CreateTable
CREATE TABLE "PayInCustodialToken" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "mtokens" BIGINT NOT NULL,
    "custodialTokenType" "CustodialTokenType" NOT NULL,
    "mtokensAfter" BIGINT,

    CONSTRAINT "PayInCustodialToken_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PayInCustodialToken" ADD CONSTRAINT "mtokens_positive" CHECK ("mtokens" >= 0) NOT VALID;
ALTER TABLE "PayInCustodialToken" ADD CONSTRAINT "mtokensAfter_positive" CHECK ("mtokensAfter" IS NULL OR "mtokensAfter" >= 0) NOT VALID;

-- CreateTable
CREATE TABLE "PessimisticEnv" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "args" JSONB,
    "error" TEXT,
    "result" JSONB,

    CONSTRAINT "PessimisticEnv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubPayOutCustodialToken" (
    "id" SERIAL NOT NULL,
    "subName" CITEXT NOT NULL,
    "payOutCustodialTokenId" INTEGER NOT NULL,

    CONSTRAINT "SubPayOutCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayOutCustodialToken" (
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

ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "mtokens_positive" CHECK ("mtokens" >= 0) NOT VALID;
ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "mtokensAfter_positive" CHECK ("mtokensAfter" IS NULL OR "mtokensAfter" >= 0) NOT VALID;

-- CreateTable
CREATE TABLE "PayInBolt11" (
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

ALTER TABLE "PayInBolt11" ADD CONSTRAINT "msatsRequested_positive" CHECK ("msatsRequested" >= 0) NOT VALID;
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "msatsReceived_positive" CHECK ("msatsReceived" IS NULL OR "msatsReceived" >= 0) NOT VALID;

-- CreateTable
CREATE TABLE "PayOutBolt11" (
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

ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "msats_positive" CHECK ("msats" >= 0) NOT VALID;

-- CreateTable
CREATE TABLE "PayInBolt11Lud18" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "name" TEXT,
    "identifier" TEXT,
    "email" TEXT,
    "pubkey" TEXT,

    CONSTRAINT "PayInBolt11Lud18_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayInBolt11NostrNote" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "note" JSONB NOT NULL,

    CONSTRAINT "PayInBolt11NostrNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayInBolt11Comment" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "PayInBolt11Comment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PollVote" ADD COLUMN     "payInId" INTEGER;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_payInId_key" ON "PollVote"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPayIn_payInId_key" ON "ItemPayIn"("payInId");

-- CreateIndex
CREATE INDEX "ItemPayIn_itemId_idx" ON "ItemPayIn"("itemId");

-- CreateIndex
CREATE INDEX "ItemPayIn_payInId_idx" ON "ItemPayIn"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPayIn_itemId_payInId_key" ON "ItemPayIn"("itemId", "payInId");

-- CreateIndex
CREATE UNIQUE INDEX "SubPayIn_payInId_key" ON "SubPayIn"("payInId");

-- CreateIndex
CREATE INDEX "SubPayIn_subName_idx" ON "SubPayIn"("subName");

-- CreateIndex
CREATE INDEX "SubPayIn_payInId_idx" ON "SubPayIn"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "SubPayIn_subName_payInId_key" ON "SubPayIn"("subName", "payInId");

-- CreateIndex
CREATE UNIQUE INDEX "PayIn_successorId_key" ON "PayIn"("successorId");

-- CreateIndex
CREATE INDEX "PayIn_userId_idx" ON "PayIn"("userId");

-- CreateIndex
CREATE INDEX "PayIn_payInType_idx" ON "PayIn"("payInType");

-- CreateIndex
CREATE INDEX "PayIn_successorId_idx" ON "PayIn"("successorId");

-- CreateIndex
CREATE INDEX "PayIn_payInStateChangedAt_idx" ON "PayIn"("payInStateChangedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PessimisticEnv_payInId_key" ON "PessimisticEnv"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "SubPayOutCustodialToken_payOutCustodialTokenId_key" ON "SubPayOutCustodialToken"("payOutCustodialTokenId");

-- CreateIndex
CREATE INDEX "SubPayOutCustodialToken_subName_idx" ON "SubPayOutCustodialToken"("subName");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11_payInId_key" ON "PayInBolt11"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11_hash_key" ON "PayInBolt11"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11_preimage_key" ON "PayInBolt11"("preimage");

-- CreateIndex
CREATE INDEX "PayInBolt11_created_at_idx" ON "PayInBolt11"("created_at");

-- CreateIndex
CREATE INDEX "PayInBolt11_confirmedIndex_idx" ON "PayInBolt11"("confirmedIndex");

-- CreateIndex
CREATE INDEX "PayInBolt11_confirmedAt_idx" ON "PayInBolt11"("confirmedAt");

-- CreateIndex
CREATE INDEX "PayInBolt11_cancelledAt_idx" ON "PayInBolt11"("cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayOutBolt11_payInId_key" ON "PayOutBolt11"("payInId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_created_at_idx" ON "PayOutBolt11"("created_at");

-- CreateIndex
CREATE INDEX "PayOutBolt11_userId_idx" ON "PayOutBolt11"("userId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_hash_idx" ON "PayOutBolt11"("hash");

-- CreateIndex
CREATE INDEX "PayOutBolt11_protocolId_idx" ON "PayOutBolt11"("protocolId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_status_idx" ON "PayOutBolt11"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11Lud18_payInBolt11Id_key" ON "PayInBolt11Lud18"("payInBolt11Id");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11NostrNote_payInBolt11Id_key" ON "PayInBolt11NostrNote"("payInBolt11Id");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11Comment_payInBolt11Id_key" ON "PayInBolt11Comment"("payInBolt11Id");

-- CreateIndex
CREATE INDEX "WalletLog_payInId_idx" ON "WalletLog"("payInId");

-- AddForeignKey
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LnWith" ADD CONSTRAINT "LnWith_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPayIn" ADD CONSTRAINT "ItemPayIn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPayIn" ADD CONSTRAINT "ItemPayIn_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayIn" ADD CONSTRAINT "SubPayIn_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayIn" ADD CONSTRAINT "SubPayIn_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_genesisId_fkey" FOREIGN KEY ("genesisId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_benefactorId_fkey" FOREIGN KEY ("benefactorId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInCustodialToken" ADD CONSTRAINT "PayInCustodialToken_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessimisticEnv" ADD CONSTRAINT "PessimisticEnv_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayOutCustodialToken" ADD CONSTRAINT "SubPayOutCustodialToken_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayOutCustodialToken" ADD CONSTRAINT "SubPayOutCustodialToken_payOutCustodialTokenId_fkey" FOREIGN KEY ("payOutCustodialTokenId") REFERENCES "PayOutCustodialToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "PayOutCustodialToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "PayOutCustodialToken_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "PayOutBolt11_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "PayOutBolt11_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "PayOutBolt11_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11Lud18" ADD CONSTRAINT "PayInBolt11Lud18_payInBolt11Id_fkey" FOREIGN KEY ("payInBolt11Id") REFERENCES "PayInBolt11"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11NostrNote" ADD CONSTRAINT "PayInBolt11NostrNote_payInBolt11Id_fkey" FOREIGN KEY ("payInBolt11Id") REFERENCES "PayInBolt11"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11Comment" ADD CONSTRAINT "PayInBolt11Comment_payInBolt11Id_fkey" FOREIGN KEY ("payInBolt11Id") REFERENCES "PayInBolt11"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- add indices associated with creating daily and hourly views
CREATE INDEX IF NOT EXISTS "PayIn.created_at_hour_index"
    ON "ItemAct"(date_trunc('hour', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "PayIn.created_at_day_index"
    ON "PayIn"(date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "PayIn.payInStateChangedAt_hour_index"
    ON "PayIn"(date_trunc('hour', "payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "PayIn.payInStateChangedAt_day_index"
    ON "PayIn"(date_trunc('day', "payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));


CREATE OR REPLACE FUNCTION check_pending_bolt11s()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule SET name = 'checkPendingPayInBolt11s', cron = '*/5 * * * *' WHERE name = 'checkPendingDeposits';
    UPDATE pgboss.schedule SET name = 'checkPendingPayOutBolt11s', cron = '*/5 * * * *' WHERE name = 'checkPendingWithdrawals';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT check_pending_bolt11s();
DROP FUNCTION check_pending_bolt11s();

-- migrates these functions to use payIn instead of invoice

CREATE OR REPLACE FUNCTION item_comments(_item_id int, _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS'
        || '    SELECT "Item".*, "Item".created_at at time zone ''UTC'' AS "createdAt", "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
        || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
        || '    to_jsonb(users.*) as user, '
        || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    JOIN LATERAL ( '
        || '        SELECT "PayIn".* '
        || '        FROM "ItemPayIn" '
        || '        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
        || '        WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."payInState" = ''PAID'' '
        || '        ORDER BY "PayIn"."created_at" DESC '
        || '        LIMIT 1 '
        || '    ) "PayIn" ON "PayIn".id IS NOT NULL '
        || '    LEFT JOIN hot_score_view g ON g.id = "Item".id '
        || '    WHERE  "Item".path <@ (SELECT path FROM "Item" WHERE id = $1) ' || _where
    USING _item_id, _level, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments("Item".id, $2 - 1, $3, $4) AS comments '
        || '    FROM   t_item "Item"'
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _level, _where, _order_by;
    RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION item_comments_limited(
    _item_id int, _limit int, _offset int, _grandchild_limit int,
    _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS '
        || 'WITH RECURSIVE base AS ( '
        || '    (SELECT "Item".*, 1 as level, ROW_NUMBER() OVER () as rn '
        || '    FROM "Item" '
        || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
        || '    WHERE "Item"."parentId" = $1 '
        ||      _order_by || ' '
        || '    LIMIT $2 '
        || '    OFFSET $3) '
        || '    UNION ALL '
        || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') '
        || '    FROM "Item" '
        || '    JOIN base b ON "Item"."parentId" = b.id '
        || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
        || '    WHERE b.level < $5 AND (b.level = 1 OR b.rn <= $4)) '
        || ') '
        || 'SELECT "Item".*, "Item".created_at at time zone ''UTC'' AS "createdAt", "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
        || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
        || '    to_jsonb(users.*) as user, '
        || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
        || 'FROM base "Item" '
        || 'JOIN users ON users.id = "Item"."userId" '
        || 'JOIN LATERAL ( '
        || '    SELECT "PayIn".* '
        || '    FROM "ItemPayIn" '
        || '    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
        || '    WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."payInState" = ''PAID'' '
        || '    ORDER BY "PayIn"."created_at" DESC '
        || '    LIMIT 1 '
        || ') "PayIn" ON "PayIn".id IS NOT NULL '
        || 'LEFT JOIN hot_score_view g ON g.id = "Item".id '
        || 'WHERE ("Item".level = 1 OR "Item".rn <= $4 - "Item".level + 2) ' || _where
    USING _item_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;


    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_limited("Item".id, $2, $3, $4, $5 - 1, $6, $7) AS comments '
        || '    FROM   t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;
    RETURN result;
END
$$;

-- add cowboy credits
CREATE OR REPLACE FUNCTION item_comments_zaprank_with_me(_item_id int, _global_seed int, _me_id int, _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS'
        || '    SELECT "Item".*, "Item".created_at at time zone ''UTC'' AS "createdAt", "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
        || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
        || '    to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
        || '    COALESCE("MeItemPayIn"."meMsats", 0) AS "meMsats", COALESCE("MeItemPayIn"."mePendingMsats", 0) as "mePendingMsats", COALESCE("MeItemPayIn"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
        || '    COALESCE("MeItemPayIn"."meMcredits", 0) AS "meMcredits", COALESCE("MeItemPayIn"."mePendingMcredits", 0) as "mePendingMcredits", '
        || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
        || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    JOIN LATERAL ( '
        || '        SELECT "PayIn".* '
        || '        FROM "ItemPayIn" '
        || '        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
        || '        WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = $5 OR "PayIn"."payInState" = ''PAID'') '
        || '        ORDER BY "PayIn"."created_at" DESC '
        || '        LIMIT 1 '
        || '    ) "PayIn" ON "PayIn".id IS NOT NULL '
        || '    LEFT JOIN "Mute" ON "Mute"."muterId" = $5 AND "Mute"."mutedId" = "Item"."userId"'
        || '    LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $5 AND "Bookmark"."itemId" = "Item".id '
        || '    LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $5 AND "ThreadSubscription"."itemId" = "Item".id '
        || '    LEFT JOIN LATERAL ( '
        || '        SELECT "itemId", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''FAILED'' AND "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMsats", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''FAILED'' AND "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMcredits", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" = ''PENDING'' AND "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMsats", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" = ''PENDING'' AND "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMcredits", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''FAILED'' AND "PayIn"."payInType" = ''DOWN_ZAP'') AS "meDontLikeMsats" '
        || '        FROM "ItemPayIn" '
        || '        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" '
        || '        LEFT JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn".id '
        || '        WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."userId" = $5 '
        || '        GROUP BY "ItemPayIn"."itemId" '
        || '    ) "MeItemPayIn" ON true '
        || '    LEFT JOIN hot_score_view g ON g.id = "Item".id '
        || '    WHERE  "Item".path <@ (SELECT path FROM "Item" WHERE id = $1) ' || _where || ' '
    USING _item_id, _level, _where, _order_by, _me_id, _global_seed;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_zaprank_with_me("Item".id, $6, $5, $2 - 1, $3, $4) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _level, _where, _order_by, _me_id, _global_seed;

    RETURN result;
END
$$;


-- add limit and offset
CREATE OR REPLACE FUNCTION item_comments_zaprank_with_me_limited(
    _item_id int, _global_seed int, _me_id int, _limit int, _offset int, _grandchild_limit int,
    _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS '
    || 'WITH RECURSIVE base AS ( '
    || '    (SELECT "Item".*, 1 as level, ROW_NUMBER() OVER () as rn '
    || '    FROM "Item" '
    || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
    || '    WHERE "Item"."parentId" = $1 '
    ||      _order_by || ' '
    || '    LIMIT $4 '
    || '    OFFSET $5) '
    || '    UNION ALL '
    || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') as rn '
    || '    FROM "Item" '
    || '    JOIN base b ON "Item"."parentId" = b.id '
    || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
    || '    WHERE b.level < $7 AND (b.level = 1 OR b.rn <= $6)) '
    || ') '
    || 'SELECT "Item".*, '
    || '    "Item".created_at at time zone ''UTC'' AS "createdAt", '
    || '    "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
    || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
    || '    to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
    || '    COALESCE("MeItemPayIn"."meMsats", 0) AS "meMsats", '
    || '    COALESCE("MeItemPayIn"."mePendingMsats", 0) as "mePendingMsats", '
    || '    COALESCE("MeItemPayIn"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
    || '    COALESCE("MeItemPayIn"."meMcredits", 0) AS "meMcredits", '
    || '    COALESCE("MeItemPayIn"."mePendingMcredits", 0) as "mePendingMcredits", '
    || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", '
    || '    "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
    || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
    || 'FROM base "Item" '
    || 'JOIN users ON users.id = "Item"."userId" '
    || 'JOIN LATERAL ( '
    || '    SELECT "PayIn".* '
    || '    FROM "ItemPayIn" '
    || '    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
    || '    WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = $3 OR "PayIn"."payInState" = ''PAID'') '
    || '    ORDER BY "PayIn"."created_at" DESC '
    || '    LIMIT 1 '
    || ') "PayIn" ON "PayIn".id IS NOT NULL '
    || 'LEFT JOIN "Mute" ON "Mute"."muterId" = $3 AND "Mute"."mutedId" = "Item"."userId" '
    || 'LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $3 AND "Bookmark"."itemId" = "Item".id '
    || 'LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $3 AND "ThreadSubscription"."itemId" = "Item".id '
    || 'LEFT JOIN hot_score_view g ON g.id = "Item".id '
    || 'LEFT JOIN LATERAL ( '
    || '    SELECT "itemId", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''FAILED'' AND "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMsats", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''FAILED'' AND "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMcredits", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" = ''PENDING'' AND "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMsats", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" = ''PENDING'' AND "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMcredits", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''FAILED'' AND "PayIn"."payInType" = ''DOWN_ZAP'') AS "meDontLikeMsats" '
    || '    FROM "ItemPayIn" '
    || '    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" '
    || '    LEFT JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn".id '
    || '    WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."userId" = $3 '
    || '    GROUP BY "ItemPayIn"."itemId" '
    || ') "MeItemPayIn" ON true '
    || 'WHERE ("Item".level = 1 OR "Item".rn <= $6 - "Item".level + 2) ' || _where || ' '
    USING _item_id, _global_seed, _me_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_zaprank_with_me_limited("Item".id, $2, $3, $4, $5, $6, $7 - 1, $8, $9) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _global_seed, _me_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    RETURN result;
END
$$;

-- AlterTable
ALTER TABLE "Earn" ADD COLUMN     "payOutCustodialTokenId" INTEGER,
ADD COLUMN     "typeProportion" FLOAT;

-- AddForeignKey
ALTER TABLE "Earn" ADD CONSTRAINT "Earn_payOutCustodialTokenId_fkey" FOREIGN KEY ("payOutCustodialTokenId") REFERENCES "PayOutCustodialToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- add user for rewards if they don't exist (for dev)
INSERT INTO users (id, name) VALUES (9513, 'rewards') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION reward_prospects(
    min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT,
    percentile_cutoff INTEGER DEFAULT 50,
    zap_threshold INTEGER DEFAULT 20,
    each_zap_portion FLOAT DEFAULT 4.0,
    each_item_portion FLOAT DEFAULT 4.0,
    handicap_ids INTEGER[] DEFAULT '{616, 6030, 4502, 27}',
    handicap_zap_mult FLOAT DEFAULT 0.5)
RETURNS TABLE (
    "userId" INTEGER,
    rank INTEGER,
    "typeProportion" FLOAT,
    "type" TEXT,
    "typeId" INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT "userId", rank, "typeProportion", "type", "typeId"
    FROM generate_series(min, max, ival) period(t)
    JOIN LATERAL (
        WITH item_proportions AS (
            SELECT *,
                CASE WHEN "parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type,
                CASE WHEN "weightedVotes" > 0 THEN "weightedVotes"/(sum("weightedVotes") OVER (PARTITION BY "parentId" IS NULL)) ELSE 0 END AS proportion
            FROM (
                SELECT *,
                    NTILE(100)  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS percentile,
                    ROW_NUMBER()  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS rank
                FROM "Item"
                JOIN LATERAL (
                    SELECT "PayIn".*
                    FROM "ItemPayIn"
                    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
                    WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = "Item"."userId" OR "PayIn"."payInState" = 'PAID')
                    ORDER BY "PayIn"."created_at" DESC
                    LIMIT 1
                ) "PayIn" ON "PayIn".id IS NOT NULL
                WHERE date_trunc(date_part, "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
                AND "weightedVotes" > 0
                AND "deletedAt" IS NULL
                AND NOT bio
            ) x
            WHERE x.percentile <= percentile_cutoff
        ),
        -- get top item zappers of top posts and comments
        item_zapper_islands AS (
            SELECT "PayIn"."userId", item_proportions.id, item_proportions.proportion, item_proportions."parentId",
                "PayIn".mcost as zapped_msats, "PayIn"."payInStateChangedAt" as acted_at,
                ROW_NUMBER() OVER (partition by item_proportions.id order by "PayIn"."payInStateChangedAt" asc)
                - ROW_NUMBER() OVER (partition by item_proportions.id, "PayIn"."userId" order by "PayIn"."payInStateChangedAt" asc) AS island
            FROM item_proportions
            JOIN "ItemPayIn" ON "ItemPayIn"."itemId" = item_proportions.id
            JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ZAP' AND "PayIn"."payInState" = 'PAID'
            WHERE date_trunc(date_part, "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
        ),
        -- isolate contiguous upzaps from the same user on the same item so that when we take the log
        -- of the upzaps it accounts for successive zaps and does not disproportionately reward them
        -- quad root of the total tipped
        item_zappers AS (
            SELECT "userId", item_zapper_islands.id, item_zapper_islands.proportion,
                item_zapper_islands."parentId", GREATEST(power(sum(zapped_msats) / 1000, 0.25), 0) as zapped_msats, min(acted_at) as acted_at
            FROM item_zapper_islands
            GROUP BY "userId", item_zapper_islands.id, item_zapper_islands.proportion, item_zapper_islands."parentId", island
            HAVING sum(zapped_msats) / 1000 > zap_threshold
        ),
        -- the relative contribution of each zapper to the post/comment
        -- early component: 1/ln(early_rank + e - 1)
        -- tipped component: how much they tipped relative to the total tipped for the item
        -- multiplied by the relative rank of the item to the total items
        -- multiplied by the trust of the user
        item_zapper_ratios AS (
            SELECT "userId", sum((2*early_multiplier+1)*tipped_ratio*ratio*handicap_mult) as item_zapper_proportion,
                "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
            FROM (
                SELECT *,
                    1.0/LN(ROW_NUMBER() OVER (partition by item_zappers.id order by acted_at asc) + EXP(1.0) - 1) AS early_multiplier,
                    zapped_msats::float/(sum(zapped_msats) OVER (partition by item_zappers.id)) zapped_msats_proportion,
                    CASE WHEN item_zappers."userId" = ANY(handicap_ids) THEN handicap_zap_mult ELSE 1 END as handicap_mult
                FROM item_zappers
                WHERE zapped_msats > 0
            ) u
            JOIN users on "userId" = users.id
            GROUP BY "userId", "parentId" IS NULL
        )
        SELECT "userId", ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY item_zapper_proportion DESC) as rank,
            item_zapper_proportion/(sum(item_zapper_proportion) OVER (PARTITION BY "isPost"))/each_zap_portion as "typeProportion",
            "type", NULL as "typeId"
        FROM item_zapper_ratios
        WHERE item_zapper_proportion > 0
        UNION ALL
        SELECT "userId", rank, item_proportions.proportion/each_item_portion as "typeProportion",
            "type", item_proportions.id as "typeId"
        FROM item_proportions
    ) "ItemProportions" ON true;
END;
$$;

DROP FUNCTION IF EXISTS rewards CASCADE;

CREATE OR REPLACE FUNCTION rewards(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), "totalMsats" BIGINT, "sources" JSONB[]
)
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(sum("PayInTypes"."totalMsats"), 0)::BIGINT as "totalMsats",
        array_agg(jsonb_build_object('name', "PayInTypes"."type", 'value', "PayInTypes"."totalMsats"))::jsonb[] as "sources"
    FROM generate_series(min, max, ival) period(t)
    JOIN LATERAL (
        SELECT "PayIn"."payInType" as "type", coalesce(sum("PayOutCustodialToken"."mtokens"), 0)::BIGINT as "totalMsats"
        FROM "PayIn"
        JOIN "PayOutCustodialToken" ON "PayOutCustodialToken"."payInId" = "PayIn"."id"
        WHERE date_trunc(date_part, "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
        AND "PayIn"."payInState" = 'PAID'
        AND "PayOutCustodialToken"."payOutType" = 'REWARDS_POOL'
        GROUP BY "PayIn"."payInType"
    ) "PayInTypes" ON true
    GROUP BY period.t;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS rewards_today;
CREATE MATERIALIZED VIEW IF NOT EXISTS rewards_today AS
SELECT (rewards(min, max, '1 day'::INTERVAL, 'day')).* FROM today;

DROP MATERIALIZED VIEW IF EXISTS rewards_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS rewards_days AS
SELECT (rewards(min, max, '1 day'::INTERVAL, 'day')).* FROM all_days;

CREATE UNIQUE INDEX IF NOT EXISTS rewards_today_idx ON rewards_today(t);
CREATE UNIQUE INDEX IF NOT EXISTS rewards_days_idx ON rewards_days(t);

UPDATE "Upload" SET "paid" = false WHERE "paid" IS NULL;

-- AlterTable
ALTER TABLE "Upload" ALTER COLUMN "paid" SET NOT NULL,
ALTER COLUMN "paid" SET DEFAULT false;

-- CreateTable
CREATE TABLE "UploadPayIn" (
    "id" SERIAL NOT NULL,
    "uploadId" INTEGER NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "UploadPayIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadPayIn_uploadId_idx" ON "UploadPayIn"("uploadId");

-- CreateIndex
CREATE INDEX "UploadPayIn_payInId_idx" ON "UploadPayIn"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadPayIn_uploadId_payInId_key" ON "UploadPayIn"("uploadId", "payInId");

-- AddForeignKey
ALTER TABLE "UploadPayIn" ADD CONSTRAINT "UploadPayIn_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadPayIn" ADD CONSTRAINT "UploadPayIn_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;