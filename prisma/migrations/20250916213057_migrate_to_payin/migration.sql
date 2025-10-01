-- todo: we can do a better job of representing territory revenue in these migrations
-- we're currently dumping it all into a rewards pool payoutcustodialtoken

-- there are also lots of tables and columns that could be the subject of deletion
-- however, it's probably better to leave them in place just in case we make a mistake
-- migrating.

-- Disable autovacuum for performance during migration
ALTER TABLE "PayIn" SET (autovacuum_enabled = false);
ALTER TABLE "PayInCustodialToken" SET (autovacuum_enabled = false);
ALTER TABLE "PayInBolt11" SET (autovacuum_enabled = false);
ALTER TABLE "PayOutCustodialToken" SET (autovacuum_enabled = false);
ALTER TABLE "PayOutBolt11" SET (autovacuum_enabled = false);
ALTER TABLE "ItemPayIn" SET (autovacuum_enabled = false);

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

--------------------
------SUBACTS-------
--------------------
    -- for all subacts, create a payin, payincustodialtoken, and payoutcustodialtoken
    -- like with donations, we don't know the funding source exactly - it could've been a pessimistic invoice
    -- or custodial tokens, so we assume it was custodial tokens, then for those invoices we'll create a
    -- BUY_CREDITS payin

CREATE TEMP TABLE subact_billing AS
SELECT "SubAct".*, "Sub"."created_at" AS "subCreatedAt"
FROM "SubAct"
JOIN "Sub" ON "Sub"."name" = "SubAct"."subName"
WHERE "SubAct"."type" = 'BILLING';

CREATE UNIQUE INDEX subact_billing_id_idx ON subact_billing (id);
ANALYZE subact_billing;

CREATE TEMP TABLE map_subact_billing_payin (subact_id INTEGER PRIMARY KEY, payin_id INTEGER NOT NULL);

WITH subact_billing_payin_prospect AS (
    SELECT subact_billing.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
    FROM subact_billing
), insert_payin AS (
    INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
    SELECT payin_id, "created_at", "updated_at", "msats",
        CASE WHEN "created_at" > "subCreatedAt" THEN 'TERRITORY_BILLING' ELSE 'TERRITORY_CREATE' END::"PayInType",
        'PAID', "created_at", "userId"
    FROM subact_billing_payin_prospect
)
INSERT INTO map_subact_billing_payin (subact_id, payin_id)
SELECT id, payin_id FROM subact_billing_payin_prospect;

INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
SELECT map_subact_billing_payin.payin_id, "msats", get_custodial_token_type("created_at")
FROM subact_billing
JOIN map_subact_billing_payin ON map_subact_billing_payin.subact_id = subact_billing.id;

INSERT INTO "SubPayIn" ("payInId", "subName")
SELECT map_subact_billing_payin.payin_id, "subName"
FROM subact_billing
JOIN map_subact_billing_payin ON map_subact_billing_payin.subact_id = subact_billing.id;

INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
SELECT "created_at", "updated_at", 4502, map_subact_billing_payin.payin_id, "msats", 'SATS', 'SYSTEM_REVENUE'
FROM subact_billing
JOIN map_subact_billing_payin ON map_subact_billing_payin.subact_id = subact_billing.id;

DROP TABLE subact_billing;
DROP TABLE map_subact_billing_payin;

CREATE TEMP TABLE subact_revenue AS
SELECT "SubAct".*, "Sub"."created_at" AS "subCreatedAt"
FROM "SubAct"
JOIN "Sub" ON "Sub"."name" = "SubAct"."subName"
WHERE "SubAct"."type" = 'REVENUE';

CREATE UNIQUE INDEX subact_revenue_id_idx ON subact_revenue (id);
ANALYZE subact_revenue;

CREATE TEMP TABLE map_subact_revenue_payin (subact_id INTEGER PRIMARY KEY, payin_id INTEGER NOT NULL);

WITH subact_revenue_payin_prospect AS (
    SELECT subact_revenue.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
    FROM subact_revenue
), insert_payin AS (
    INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
    SELECT payin_id, "created_at", "updated_at", "msats", 'DEFUNCT_TERRITORY_DAILY_PAYOUT', 'PAID', "created_at", 9513
    FROM subact_revenue_payin_prospect
)
INSERT INTO map_subact_revenue_payin (subact_id, payin_id)
SELECT id, payin_id FROM subact_revenue_payin_prospect;

INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
SELECT map_subact_revenue_payin.payin_id, "msats", 'SATS'
FROM subact_revenue
JOIN map_subact_revenue_payin ON map_subact_revenue_payin.subact_id = subact_revenue.id;

CREATE TEMP TABLE map_subact_revenue_payoutcustodialtoken (subact_id INTEGER PRIMARY KEY, payoutcustodialtoken_id INTEGER NOT NULL);

WITH subact_revenue_payoutcustodialtoken_prospect AS (
    SELECT subact_revenue.*, map_payin.payin_id, nextval(pg_get_serial_sequence('"PayOutCustodialToken"', 'id')) AS payoutcustodialtoken_id
    FROM subact_revenue
    JOIN map_subact_revenue_payin map_payin ON map_payin.subact_id = subact_revenue.id
), insert_payoutcustodialtoken AS (
    INSERT INTO "PayOutCustodialToken" (id, created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
    SELECT payoutcustodialtoken_id, "created_at", "updated_at", "userId", payin_id, "msats", 'SATS', 'TERRITORY_REVENUE'
    FROM subact_revenue_payoutcustodialtoken_prospect
)
INSERT INTO map_subact_revenue_payoutcustodialtoken (subact_id, payoutcustodialtoken_id)
SELECT id, payoutcustodialtoken_id FROM subact_revenue_payoutcustodialtoken_prospect;

INSERT INTO "SubPayOutCustodialToken" ("payOutCustodialTokenId", "subName")
SELECT payoutcustodialtoken_id, "subName"
FROM subact_revenue
JOIN map_subact_revenue_payoutcustodialtoken ON map_subact_revenue_payoutcustodialtoken.subact_id = subact_revenue.id;

DROP TABLE subact_revenue;
DROP TABLE map_subact_revenue_payin;
DROP TABLE map_subact_revenue_payoutcustodialtoken;

--------------------
------EARN----------
--------------------

--- this is tricky ... we'll need to group by day and user
--- each day will be its own payin, and each user for that day will be its own payoutcustodialtoken
--- which must be associated with the earn rows

CREATE TEMP TABLE earn_day AS
SELECT sum("msats") AS "msats", "created_at"
FROM "Earn"
GROUP BY "Earn"."created_at";

CREATE UNIQUE INDEX earn_day_id_idx ON earn_day ("created_at");
ANALYZE earn_day;

CREATE TEMP TABLE map_earn_day_payin (created_at TIMESTAMP PRIMARY KEY, payin_id INTEGER NOT NULL);

WITH earn_day_payin_prospect AS (
    SELECT earn_day.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
    FROM earn_day
), insert_payin AS (
    INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
    SELECT payin_id, "created_at", "created_at", "msats", 'REWARDS', 'PAID', "created_at", 9513
    FROM earn_day_payin_prospect
)
INSERT INTO map_earn_day_payin (created_at, payin_id)
SELECT "created_at", payin_id FROM earn_day_payin_prospect;

INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
SELECT map_earn_day_payin.payin_id, "msats", 'SATS'
FROM earn_day
JOIN map_earn_day_payin ON map_earn_day_payin.created_at = earn_day.created_at;

WITH payouts AS (
    INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
    SELECT "Earn"."created_at", "Earn"."created_at", "Earn"."userId", map_earn_day_payin.payin_id, SUM("Earn"."msats"), 'SATS', 'REWARD'
    FROM earn_day
    JOIN map_earn_day_payin ON map_earn_day_payin.created_at = earn_day.created_at
    JOIN "Earn" ON "Earn"."created_at" = earn_day.created_at
    GROUP BY map_earn_day_payin.payin_id, "Earn"."created_at", "Earn"."userId"
    RETURNING id, "created_at", "userId"
)
UPDATE "Earn" SET "payOutCustodialTokenId" = payouts.id
FROM payouts
WHERE "Earn"."created_at" = payouts."created_at" AND "Earn"."userId" = payouts."userId";

DROP TABLE earn_day;
DROP TABLE map_earn_day_payin;

--------------------------
-----INVOICE: RECEIVE-----
--------------------------

-- Batched invoice migration to handle large datasets
DO $$
DECLARE
    batch_size INTEGER := 30000;
    offset_val INTEGER := 0;
    rows_processed INTEGER;
    batch_num INTEGER := 1;
    max_id INTEGER;
BEGIN
    -- Get max invoice ID for progress tracking
    SELECT COALESCE(MAX("Invoice"."id"), 0) INTO max_id
    FROM "Invoice"
    JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
    WHERE "Invoice"."actionType" = 'RECEIVE' AND "Invoice"."actionState" IN ('PAID', 'FAILED', 'RETRYING');

    RAISE LOG 'Processing % total receive invoices in batches of %', max_id, batch_size;

    -- Create persistent temp tables for the entire invoice migration
    DROP TABLE IF EXISTS invoice_batch;
    DROP TABLE IF EXISTS map_invoice_payin_batch;

    CREATE TEMP TABLE invoice_batch AS
    SELECT "Invoice".*, "InvoiceForward"."expiryHeight", "InvoiceForward"."acceptHeight",
           "InvoiceForward"."bolt11" AS "forwardBolt11", "InvoiceForward"."withdrawlId" AS "withdrawalId"
    FROM "Invoice"
    JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
    WHERE FALSE; -- Empty template

    CREATE TEMP TABLE map_invoice_payin_batch (
        payin_id INTEGER PRIMARY KEY,
        invoice_id INTEGER NOT NULL
    );

    LOOP
        RAISE LOG 'Processing invoice batch % (IDs % to %)', batch_num, offset_val + 1, offset_val + batch_size;

        -- Clear batch tables
        TRUNCATE invoice_batch;
        TRUNCATE map_invoice_payin_batch;

        -- Load next batch
        INSERT INTO invoice_batch
        SELECT "Invoice".*, "InvoiceForward"."expiryHeight", "InvoiceForward"."acceptHeight",
               "InvoiceForward"."bolt11" AS "forwardBolt11", "InvoiceForward"."withdrawlId" AS "withdrawalId"
        FROM "Invoice"
        JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
        WHERE "Invoice"."actionType" = 'RECEIVE'
          AND "Invoice"."actionState" IN ('PAID', 'FAILED', 'RETRYING')
          AND "Invoice"."id" > offset_val
        ORDER BY "Invoice"."id"
        LIMIT batch_size;

        GET DIAGNOSTICS rows_processed = ROW_COUNT;
        EXIT WHEN rows_processed = 0;

        -- Create indexes for this batch
        DROP INDEX IF EXISTS invoice_batch_id_idx;
        DROP INDEX IF EXISTS invoice_batch_hash_idx;
        DROP INDEX IF EXISTS invoice_batch_withdrawalId_idx;
        CREATE UNIQUE INDEX invoice_batch_id_idx ON invoice_batch (id);
        CREATE UNIQUE INDEX invoice_batch_hash_idx ON invoice_batch (hash);
        CREATE INDEX invoice_batch_withdrawalId_idx ON invoice_batch ("withdrawalId");
        ANALYZE invoice_batch;

        -- Process PayIn records for this batch
        WITH invoice_payin_prospect AS (
            SELECT invoice_batch.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
            FROM invoice_batch
        ), insert_payin AS (
            INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
            SELECT payin_id, "created_at", "updated_at", "msatsRequested", 'PROXY_PAYMENT',
             CASE WHEN "actionState" = 'PAID' THEN 'PAID' ELSE 'FAILED' END::"PayInState", "updated_at", "userId"
            FROM invoice_payin_prospect
            RETURNING *
        )
        INSERT INTO map_invoice_payin_batch (invoice_id, payin_id)
        SELECT id, payin_id FROM invoice_payin_prospect;

        -- Insert PayInBolt11 records for this batch
        INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight")
        SELECT "created_at", "updated_at", map_invoice_payin_batch.payin_id, "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight"
        FROM invoice_batch
        JOIN map_invoice_payin_batch ON map_invoice_payin_batch.invoice_id = invoice_batch.id;

        -- Insert bolt11 comments, lud18 data, and nostr notes for this batch
        WITH bolt11s AS (
            SELECT invoice_batch.comment, invoice_batch."lud18Data", invoice_batch."desc",
                   map_invoice_payin_batch.payin_id, "PayInBolt11"."id" AS "payInBolt11Id"
            FROM invoice_batch
            JOIN map_invoice_payin_batch ON map_invoice_payin_batch.invoice_id = invoice_batch.id
            JOIN "PayInBolt11" ON "PayInBolt11"."payInId" = map_invoice_payin_batch.payin_id
        ), insert_bolt11_comments AS (
            INSERT INTO "PayInBolt11Comment" ("payInBolt11Id", "comment")
            SELECT "payInBolt11Id", comment
            FROM bolt11s
            WHERE comment IS NOT NULL
        ), insert_bolt11_lud18s AS (
            INSERT INTO "PayInBolt11Lud18" ("payInBolt11Id", "name", "identifier", "email", "pubkey")
            SELECT "payInBolt11Id", "lud18Data"->>'name', "lud18Data"->>'identifier', "lud18Data"->>'email', "lud18Data"->>'pubkey'
            FROM bolt11s
            WHERE "lud18Data" IS NOT NULL
        )
        INSERT INTO "PayInBolt11NostrNote" ("payInBolt11Id", "note")
        SELECT "payInBolt11Id", "desc"::jsonb
        FROM bolt11s
        WHERE "desc" IS JSON;

        -- Insert PayOutBolt11 records for this batch
        INSERT INTO "PayOutBolt11" (created_at, updated_at, "payOutType", "hash", "preimage",
            "bolt11", "msats", "status", "userId", "payInId", "protocolId")
        SELECT invoice_batch."created_at", invoice_batch."updated_at", 'PROXY_PAYMENT', invoice_batch."hash", "Withdrawl"."preimage",
            "Withdrawl"."bolt11", "Withdrawl"."msatsPaying", "Withdrawl"."status", "Withdrawl"."userId", map_invoice_payin_batch.payin_id, "Withdrawl"."protocolId"
        FROM invoice_batch
        JOIN map_invoice_payin_batch ON map_invoice_payin_batch.invoice_id = invoice_batch.id
        JOIN "Withdrawl" ON "Withdrawl"."id" = invoice_batch."withdrawalId"
        WHERE invoice_batch."withdrawalId" IS NOT NULL;

        -- Insert routing fee PayOutCustodialToken records for this batch
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT "Withdrawl"."created_at", "Withdrawl"."updated_at", "Withdrawl"."userId", map_invoice_payin_batch.payin_id,
            COALESCE("Withdrawl"."msatsFeePaid", "Withdrawl"."msatsFeePaying"), 'SATS', 'ROUTING_FEE'
        FROM invoice_batch
        JOIN map_invoice_payin_batch ON map_invoice_payin_batch.invoice_id = invoice_batch.id
        JOIN "Withdrawl" ON "Withdrawl"."id" = invoice_batch."withdrawalId"
        WHERE invoice_batch."withdrawalId" IS NOT NULL;

        -- Insert rewards pool PayOutCustodialToken records for withdrawals
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT invoice_batch."created_at", invoice_batch."updated_at", "Withdrawl"."userId", map_invoice_payin_batch.payin_id,
            invoice_batch."msatsRequested" - COALESCE("Withdrawl"."msatsFeePaid", "Withdrawl"."msatsFeePaying") - COALESCE("Withdrawl"."msatsPaid", "Withdrawl"."msatsPaying"),
            'SATS', 'REWARDS_POOL'
        FROM invoice_batch
        JOIN map_invoice_payin_batch ON map_invoice_payin_batch.invoice_id = invoice_batch.id
        JOIN "Withdrawl" ON "Withdrawl"."id" = invoice_batch."withdrawalId"
        WHERE invoice_batch."withdrawalId" IS NOT NULL;

        -- Insert rewards pool PayOutCustodialToken records for non-withdrawals
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT invoice_batch."created_at", invoice_batch."updated_at", 9513, map_invoice_payin_batch.payin_id, invoice_batch."msatsRequested", 'SATS', 'REWARDS_POOL'
        FROM invoice_batch
        JOIN map_invoice_payin_batch ON map_invoice_payin_batch.invoice_id = invoice_batch.id
        WHERE invoice_batch."withdrawalId" IS NULL;

        -- Update offset for next batch
        SELECT MAX(id) INTO offset_val FROM invoice_batch;
        batch_num := batch_num + 1;
    END LOOP;

    -- Clean up
    DROP TABLE IF EXISTS invoice_batch;
    DROP TABLE IF EXISTS map_invoice_payin_batch;

    RAISE LOG 'Completed invoice migration in % batches', batch_num - 1;
END $$;

--------------------------
---INVOICE: Pessimistic---
--------------------------

-- Batched pessimistic invoice migration to handle large datasets
DO $$
DECLARE
    batch_size INTEGER := 30000;
    offset_val INTEGER := 0;
    rows_processed INTEGER;
    batch_num INTEGER := 1;
    max_id INTEGER;
BEGIN
    -- Get max invoice ID for progress tracking
    SELECT COALESCE(MAX("Invoice"."id"), 0) INTO max_id
    FROM "Invoice"
    LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
    WHERE "InvoiceForward".id IS NULL AND (
        "Invoice"."actionType" IS NULL OR
        "Invoice"."actionType" IN ('BUY_CREDITS', 'DONATE', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE')
    );

    RAISE LOG 'Processing % total pessimistic invoices in batches of %', max_id, batch_size;

    -- Create persistent temp tables for the entire invoice migration
    DROP TABLE IF EXISTS invoice_pessimistic_batch;
    DROP TABLE IF EXISTS map_invoice_pessimistic_payin_batch;

    CREATE TEMP TABLE invoice_pessimistic_batch AS
    SELECT "Invoice".*
    FROM "Invoice"
    WHERE FALSE; -- Empty template

    CREATE TEMP TABLE map_invoice_pessimistic_payin_batch (
        payin_id INTEGER PRIMARY KEY,
        invoice_pessimistic_id INTEGER NOT NULL
    );

    LOOP
        RAISE LOG 'Processing pessimistic invoice batch % (IDs % to %)', batch_num, offset_val + 1, offset_val + batch_size;

        -- Clear batch tables
        TRUNCATE invoice_pessimistic_batch;
        TRUNCATE map_invoice_pessimistic_payin_batch;

        -- Load next batch
        INSERT INTO invoice_pessimistic_batch
        SELECT "Invoice".*
        FROM "Invoice"
        LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
        WHERE "InvoiceForward".id IS NULL
          AND ("Invoice"."actionType" IS NULL OR "Invoice"."actionType" IN ('BUY_CREDITS', 'DONATE', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE'))
          AND "Invoice"."id" > offset_val
        ORDER BY "Invoice"."id"
        LIMIT batch_size;

        GET DIAGNOSTICS rows_processed = ROW_COUNT;
        EXIT WHEN rows_processed = 0;

        -- Create indexes for this batch
        DROP INDEX IF EXISTS invoice_pessimistic_batch_id_idx;
        DROP INDEX IF EXISTS invoice_pessimistic_batch_hash_idx;
        CREATE UNIQUE INDEX invoice_pessimistic_batch_id_idx ON invoice_pessimistic_batch (id);
        CREATE UNIQUE INDEX invoice_pessimistic_batch_hash_idx ON invoice_pessimistic_batch (hash);
        ANALYZE invoice_pessimistic_batch;

        -- Process PayIn records for this batch
        WITH invoice_pessimistic_payin_prospect AS (
            SELECT invoice_pessimistic_batch.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
            FROM invoice_pessimistic_batch
        ), insert_payin AS (
            INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
            SELECT payin_id, "created_at", "updated_at", COALESCE("msatsReceived", "msatsRequested"), 'BUY_CREDITS',
                CASE WHEN "confirmedAt" IS NOT NULL THEN 'PAID' ELSE 'FAILED' END::"PayInState",
                "updated_at", "userId"
            FROM invoice_pessimistic_payin_prospect
        )
        INSERT INTO map_invoice_pessimistic_payin_batch (invoice_pessimistic_id, payin_id)
        SELECT id, payin_id FROM invoice_pessimistic_payin_prospect;

        -- Insert PayInBolt11 records for this batch
        INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId")
        SELECT "created_at", "updated_at", map_invoice_pessimistic_payin_batch.payin_id, "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId"
        FROM invoice_pessimistic_batch
        JOIN map_invoice_pessimistic_payin_batch ON map_invoice_pessimistic_payin_batch.invoice_pessimistic_id = invoice_pessimistic_batch.id;

        -- Insert PayOutCustodialToken records for this batch
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT "created_at", "updated_at", "userId", map_invoice_pessimistic_payin_batch.payin_id,
            COALESCE(invoice_pessimistic_batch."msatsReceived", invoice_pessimistic_batch."msatsRequested"),
            get_custodial_token_type(invoice_pessimistic_batch."created_at"), 'BUY_CREDITS'
        FROM invoice_pessimistic_batch
        JOIN map_invoice_pessimistic_payin_batch ON map_invoice_pessimistic_payin_batch.invoice_pessimistic_id = invoice_pessimistic_batch.id;

        -- Update offset for next batch
        SELECT MAX(id) INTO offset_val FROM invoice_pessimistic_batch;
        batch_num := batch_num + 1;
    END LOOP;

    -- Clean up
    DROP TABLE IF EXISTS invoice_pessimistic_batch;
    DROP TABLE IF EXISTS map_invoice_pessimistic_payin_batch;

    RAISE LOG 'Completed pessimistic invoice migration in % batches', batch_num - 1;
END $$;

--------------------------
-------Item Create--------
--------------------------

-- Batched item create migration to handle large datasets
DO $$
DECLARE
    batch_size INTEGER := 30000;
    offset_val INTEGER := 0;
    rows_processed INTEGER;
    batch_num INTEGER := 1;
    max_id INTEGER;
BEGIN
    -- Get max item ID for progress tracking
    SELECT COALESCE(MAX("id"), 0) INTO max_id FROM "Item";
    RAISE LOG 'Processing % total items in batches of %', max_id, batch_size;

    -- Create persistent temp tables for the entire item create migration
    DROP TABLE IF EXISTS item_create_batch;
    DROP TABLE IF EXISTS map_item_create_payin_batch;

    CREATE TEMP TABLE item_create_batch (
        id INTEGER PRIMARY KEY,
        "userId" INTEGER,
        created_at TIMESTAMP,
        "invoiceId" INTEGER,
        hash TEXT,
        preimage TEXT,
        bolt11 TEXT,
        "expiresAt" TIMESTAMP,
        "confirmedAt" TIMESTAMP,
        "confirmedIndex" INTEGER,
        "cancelledAt" TIMESTAMP,
        "msatsRequested" BIGINT,
        "msatsReceived" BIGINT,
        "actionState" TEXT,
        invoice_created_at TIMESTAMP,
        invoice_updated_at TIMESTAMP,
        fee_msats BIGINT,
        upload_ids INTEGER[]
    );

    CREATE TEMP TABLE map_item_create_payin_batch (
        item_id INTEGER PRIMARY KEY,
        payin_id INTEGER NOT NULL
    );

    LOOP
        RAISE LOG 'Processing item create batch % (IDs % to %)', batch_num, offset_val + 1, offset_val + batch_size;

        -- Clear batch tables
        TRUNCATE item_create_batch;
        TRUNCATE map_item_create_payin_batch;

        -- Load next batch
        INSERT INTO item_create_batch
        SELECT "Item".id, "Item"."userId", "Item".created_at, "Item"."invoiceId",
               "Invoice"."hash", "Invoice"."preimage", "Invoice"."bolt11", "Invoice"."expiresAt",
               "Invoice"."confirmedAt", "Invoice"."confirmedIndex", "Invoice"."cancelledAt",
               "Invoice"."msatsRequested", "Invoice"."msatsReceived", "Invoice"."actionState",
               "Invoice"."created_at" AS invoice_created_at, "Invoice"."updated_at" AS invoice_updated_at,
               COALESCE(item_fee_acts.msats, 0) AS fee_msats,
               item_uploads.upload_ids
        FROM "Item"
        LEFT JOIN "Invoice" ON "Invoice".id = "Item"."invoiceId"
        LEFT JOIN LATERAL (
            SELECT sum("msats") AS msats
            FROM "ItemAct"
            WHERE "ItemAct"."itemId" = "Item"."id"
              AND "ItemAct"."act" = 'FEE'
              AND "ItemAct"."userId" = "Item"."userId"
            GROUP BY "ItemAct"."itemId"
        ) AS item_fee_acts ON TRUE
        LEFT JOIN LATERAL (
            SELECT array_agg("uploadId") AS upload_ids
            FROM "ItemUpload"
            WHERE "ItemUpload"."itemId" = "Item"."id"
            GROUP BY "ItemUpload"."itemId"
        ) AS item_uploads ON TRUE
        WHERE "Item".id > offset_val
        ORDER BY "Item".id
        LIMIT batch_size;

        GET DIAGNOSTICS rows_processed = ROW_COUNT;
        EXIT WHEN rows_processed = 0;

        -- Create indexes for this batch
        DROP INDEX IF EXISTS item_create_batch_id_idx;
        DROP INDEX IF EXISTS item_create_batch_hash_idx;
        CREATE UNIQUE INDEX item_create_batch_id_idx ON item_create_batch (id);
        CREATE UNIQUE INDEX item_create_batch_hash_idx ON item_create_batch (hash);
        ANALYZE item_create_batch;

        -- Process PayIn records for this batch
        WITH item_create_payin_prospect AS (
            SELECT item_create_batch.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
            FROM item_create_batch
        ), insert_payin AS (
            INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
            SELECT payin_id,
                   "created_at",
                   COALESCE("confirmedAt", "invoice_updated_at", "created_at"),
                   fee_msats,
                   'ITEM_CREATE'::"PayInType",
                   CASE WHEN "actionState" IS NULL OR "actionState" = 'PAID' THEN 'PAID' ELSE 'FAILED' END::"PayInState",
                   COALESCE("confirmedAt", "invoice_updated_at", "created_at"),
                   "userId"
            FROM item_create_payin_prospect
        )
        INSERT INTO map_item_create_payin_batch (item_id, payin_id)
        SELECT id, payin_id FROM item_create_payin_prospect;

        -- Insert ItemPayIn records for this batch
        INSERT INTO "ItemPayIn" ("payInId", "itemId")
        SELECT map_item_create_payin_batch.payin_id, item_id
        FROM map_item_create_payin_batch;

        -- Insert PayInBolt11 records for items with invoices
        INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId")
        SELECT "invoice_created_at", "invoice_updated_at", map_item_create_payin_batch.payin_id, "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId"
        FROM item_create_batch
        JOIN map_item_create_payin_batch ON map_item_create_payin_batch.item_id = item_create_batch.id
        WHERE "hash" IS NOT NULL;

        -- Insert custodial tokens for the difference between fee and invoice amount
        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
        SELECT map_item_create_payin_batch.payin_id,
               fee_msats - COALESCE("msatsRequested", 0),
               get_custodial_token_type("created_at")
        FROM item_create_batch
        JOIN map_item_create_payin_batch ON map_item_create_payin_batch.item_id = item_create_batch.id
        WHERE fee_msats - COALESCE("msatsRequested", 0) > 0;

        -- Insert upload associations
        INSERT INTO "UploadPayIn" ("payInId", "uploadId")
        SELECT map_item_create_payin_batch.payin_id, unnest(upload_ids)
        FROM item_create_batch
        JOIN map_item_create_payin_batch ON map_item_create_payin_batch.item_id = item_create_batch.id
        WHERE upload_ids IS NOT NULL;

        -- Insert payout to rewards pool for fees
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT "created_at", "created_at", 9513, map_item_create_payin_batch.payin_id, fee_msats, 'SATS', 'REWARDS_POOL'
        FROM item_create_batch
        JOIN map_item_create_payin_batch ON map_item_create_payin_batch.item_id = item_create_batch.id
        WHERE fee_msats > 0;

        -- Update offset for next batch
        SELECT MAX(id) INTO offset_val FROM item_create_batch;
        batch_num := batch_num + 1;
    END LOOP;

    -- Clean up
    DROP TABLE IF EXISTS item_create_batch;
    DROP TABLE IF EXISTS map_item_create_payin_batch;

    RAISE LOG 'Completed item create migration in % batches', batch_num - 1;
END $$;

--------------------------
-------Item Act: ZAPS-----
--------------------------

-- Create temporary covering indexes to speed up zap migration
CREATE INDEX IF NOT EXISTS "ItemAct_zap_covering_idx"
  ON "ItemAct"("id", "itemId", "userId", "created_at", "invoiceId", "msats", "act")
  WHERE "act" IN ('TIP', 'FEE');

CREATE INDEX IF NOT EXISTS "Item_userId_covering_idx"
  ON "Item"("id", "userId");

CREATE INDEX IF NOT EXISTS "Invoice_covering_zap_idx"
  ON "Invoice"("id")
  INCLUDE ("hash", "preimage", "bolt11", "expiresAt", "confirmedAt", "confirmedIndex",
           "cancelledAt", "msatsRequested", "msatsReceived", "actionState", "created_at", "updated_at");

CREATE INDEX IF NOT EXISTS "InvoiceForward_covering_zap_idx"
  ON "InvoiceForward"("invoiceId")
  INCLUDE ("bolt11", "expiryHeight", "acceptHeight", "withdrawlId");

CREATE INDEX IF NOT EXISTS "Withdrawl_covering_zap_idx"
  ON "Withdrawl"("id")
  INCLUDE ("hash", "preimage", "msatsPaying", "msatsFeePaying", "msatsFeePaid",
           "msatsPaid", "status", "protocolId", "created_at", "updated_at");

CREATE INDEX IF NOT EXISTS "ReferralAct_zap_idx"
  ON "ReferralAct"("itemActId", "referrerId", "msats") WHERE "msats" > 0;

CREATE INDEX IF NOT EXISTS "ItemForward_zap_idx"
  ON "ItemForward"("itemId", "userId", "pct") WHERE "pct" > 0;

-- Batched zap migration to handle large datasets
DO $$
DECLARE
    batch_size INTEGER := 10000;  -- Process Items in batches of 10k
    min_id INTEGER := 0;
    max_id INTEGER;
    rows_processed INTEGER;
    batch_num INTEGER := 1;
BEGIN
    -- Get the max Item ID that has zaps
    SELECT COALESCE(MAX("Item"."id"), 0) INTO max_id
    FROM "Item"
    WHERE EXISTS (
        SELECT 1 FROM "ItemAct"
        WHERE "ItemAct"."itemId" = "Item"."id"
          AND "ItemAct"."act" IN ('TIP', 'FEE')
    );
    RAISE LOG 'Processing Items up to ID % in batches of %', max_id, batch_size;

    -- Create persistent temp tables for batch processing
    DROP TABLE IF EXISTS item_act_zaps_batch;
    DROP TABLE IF EXISTS zap_referral_acts_batch;
    DROP TABLE IF EXISTS zap_forwards_batch;
    DROP TABLE IF EXISTS map_zap_payin_batch;

    CREATE TEMP TABLE item_act_zaps_batch (
        "itemId" INTEGER,
        "userId" INTEGER,
        "created_at" TIMESTAMP,
        "invoiceId" INTEGER,
        "msats" BIGINT,
        "tipMsats" BIGINT,
        "feeMsats" BIGINT,
        "feeId" INTEGER,
        "targetUserId" INTEGER,
        "hash" TEXT,
        "preimage" TEXT,
        "bolt11" TEXT,
        "expiresAt" TIMESTAMP,
        "confirmedAt" TIMESTAMP,
        "confirmedIndex" INTEGER,
        "cancelledAt" TIMESTAMP,
        "msatsRequested" BIGINT,
        "msatsReceived" BIGINT,
        "actionState" TEXT,
        "invoice_created_at" TIMESTAMP,
        "invoice_updated_at" TIMESTAMP,
        "forward_bolt11" TEXT,
        "expiryHeight" INTEGER,
        "acceptHeight" INTEGER,
        "withdrawal_hash" TEXT,
        "withdrawal_preimage" TEXT,
        "msatsPaying" BIGINT,
        "msatsFeePaying" BIGINT,
        "msatsFeePaid" BIGINT,
        "msatsPaid" BIGINT,
        "withdrawal_status" "WithdrawlStatus",
        "protocolId" INTEGER,
        "withdrawal_created_at" TIMESTAMP,
        "withdrawal_updated_at" TIMESTAMP,
        PRIMARY KEY ("itemId", "userId", "created_at", "invoiceId", "targetUserId")
    );

    CREATE INDEX IF NOT EXISTS "item_act_zaps_batch_invoice_id_idx" ON item_act_zaps_batch ("invoiceId");

    CREATE TEMP TABLE zap_referral_acts_batch (
        "itemId" INTEGER,
        "userId" INTEGER,
        "created_at" TIMESTAMP,
        "invoiceId" INTEGER,
        "referrerId" INTEGER,
        "msats" BIGINT
    );

    CREATE INDEX IF NOT EXISTS "zap_referral_acts_batch_item_id_idx" ON zap_referral_acts_batch ("itemId", "userId", "created_at", "invoiceId");

    CREATE TEMP TABLE zap_forwards_batch (
        "itemId" INTEGER,
        "userId" INTEGER,
        "created_at" TIMESTAMP,
        "invoiceId" INTEGER,
        "forward_user_id" INTEGER,
        "pct" INTEGER
    );

    CREATE INDEX IF NOT EXISTS "zap_forwards_batch_item_id_idx" ON zap_forwards_batch ("itemId", "userId", "created_at", "invoiceId");

    CREATE TEMP TABLE map_zap_payin_batch (
        item_id INTEGER,
        user_id INTEGER,
        created_at TIMESTAMP,
        invoice_id INTEGER,
        payin_id INTEGER NOT NULL,
        PRIMARY KEY (item_id, payin_id)
    );

    CREATE INDEX IF NOT EXISTS "map_zap_payin_batch_item_id_idx" ON map_zap_payin_batch ("item_id", "user_id", "created_at", "invoice_id");

    LOOP
        EXIT WHEN min_id > max_id;

        RAISE LOG 'Processing zap batch % (Item IDs % to %)', batch_num, min_id, min_id + batch_size;

        -- Clear batch tables
        TRUNCATE item_act_zaps_batch;
        TRUNCATE zap_referral_acts_batch;
        TRUNCATE zap_forwards_batch;
        TRUNCATE map_zap_payin_batch;

        -- Aggregate zaps for Items in this ID range only
        -- This is more efficient because:
        -- 1. Better data locality for GROUP BY
        -- 2. All ItemForward joins will be for consecutive Item IDs
        -- 3. ReferralAct joins benefit from processing related items together
        INSERT INTO item_act_zaps_batch
        SELECT "ItemAct"."itemId", "ItemAct"."userId", "ItemAct"."created_at", "ItemAct"."invoiceId",
               sum("ItemAct"."msats") AS "msats",
               sum(CASE WHEN "ItemAct"."act" = 'TIP' THEN "ItemAct"."msats" ELSE 0 END) AS "tipMsats",
               sum(CASE WHEN "ItemAct"."act" = 'FEE' THEN "ItemAct"."msats" ELSE 0 END) AS "feeMsats",
               max("ItemAct"."id") FILTER(WHERE "ItemAct"."act" = 'FEE') AS "feeId",
               "Item"."userId" AS "targetUserId",
               NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
               NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        FROM "ItemAct"
        JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
        WHERE "ItemAct"."act" IN ('TIP', 'FEE')
          AND "ItemAct"."userId" <> "Item"."userId"
          AND "Item"."id" > min_id
          AND "Item"."id" <= min_id + batch_size
        GROUP BY "ItemAct"."itemId", "ItemAct"."userId", "ItemAct"."created_at", "ItemAct"."invoiceId", "Item"."userId";

        ANALYZE item_act_zaps_batch;

        GET DIAGNOSTICS rows_processed = ROW_COUNT;
        EXIT WHEN rows_processed = 0;

        -- Now join invoice data only for rows that have invoices
        UPDATE item_act_zaps_batch AS zaps
        SET "hash" = "Invoice"."hash",
            "preimage" = "Invoice"."preimage",
            "bolt11" = "Invoice"."bolt11",
            "expiresAt" = "Invoice"."expiresAt",
            "confirmedAt" = "Invoice"."confirmedAt",
            "confirmedIndex" = "Invoice"."confirmedIndex",
            "cancelledAt" = "Invoice"."cancelledAt",
            "msatsRequested" = "Invoice"."msatsRequested",
            "msatsReceived" = "Invoice"."msatsReceived",
            "actionState" = "Invoice"."actionState",
            "invoice_created_at" = "Invoice"."created_at",
            "invoice_updated_at" = "Invoice"."updated_at",
            "forward_bolt11" = "InvoiceForward"."bolt11",
            "expiryHeight" = "InvoiceForward"."expiryHeight",
            "acceptHeight" = "InvoiceForward"."acceptHeight",
            "withdrawal_hash" = "Withdrawl"."hash",
            "withdrawal_preimage" = "Withdrawl"."preimage",
            "msatsPaying" = "Withdrawl"."msatsPaying",
            "msatsFeePaying" = "Withdrawl"."msatsFeePaying",
            "msatsFeePaid" = "Withdrawl"."msatsFeePaid",
            "msatsPaid" = "Withdrawl"."msatsPaid",
            "withdrawal_status" = "Withdrawl"."status",
            "protocolId" = "Withdrawl"."protocolId",
            "withdrawal_created_at" = "Withdrawl"."created_at",
            "withdrawal_updated_at" = "Withdrawl"."updated_at"
        FROM "Invoice"
        LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
        LEFT JOIN "Withdrawl" ON "Withdrawl"."id" = "InvoiceForward"."withdrawlId"
        WHERE "Invoice".id = zaps."invoiceId" AND zaps."invoiceId" IS NOT NULL;

        ANALYZE item_act_zaps_batch;

        -- Load referral acts for this batch
        INSERT INTO zap_referral_acts_batch
        SELECT zaps."itemId", zaps."userId", zaps."created_at", zaps."invoiceId",
               "ReferralAct"."referrerId", "ReferralAct"."msats"
        FROM item_act_zaps_batch zaps
        JOIN "ReferralAct" ON "ReferralAct"."itemActId" = zaps."feeId"
        WHERE "ReferralAct"."msats" > 0;

        ANALYZE zap_referral_acts_batch;

        -- Load forwards for this batch
        INSERT INTO zap_forwards_batch
        SELECT zaps."itemId", zaps."userId", zaps."created_at", zaps."invoiceId",
               "ItemForward"."userId" AS forward_user_id, "ItemForward"."pct"
        FROM item_act_zaps_batch zaps
        JOIN "ItemForward" ON "ItemForward"."itemId" = zaps."itemId"
        WHERE "ItemForward"."pct" > 0;

        ANALYZE zap_forwards_batch;

        -- Skip ANALYZE in loop for speed (only needed at start)

        -- Insert PayIn records for this batch
        WITH zap_payin_prospect AS (
            SELECT item_act_zaps_batch.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
            FROM item_act_zaps_batch
        ), insert_payin AS (
            INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
            SELECT payin_id,
                   "created_at",
                   COALESCE("confirmedAt", "invoice_updated_at", "created_at"),
                   "msats",
                   'ZAP'::"PayInType",
                   CASE WHEN "confirmedAt" IS NOT NULL THEN 'PAID'::"PayInState" ELSE 'FAILED'::"PayInState" END,
                   COALESCE("confirmedAt", "invoice_updated_at", "created_at"),
                   "userId"
            FROM zap_payin_prospect
        )
        INSERT INTO map_zap_payin_batch (item_id, user_id, created_at, invoice_id, payin_id)
        SELECT "itemId", "userId", "created_at", COALESCE("invoiceId", 0), payin_id
        FROM zap_payin_prospect;

        ANALYZE map_zap_payin_batch;

        -- Insert ItemPayIn records
        INSERT INTO "ItemPayIn" ("payInId", "itemId")
        SELECT map.payin_id, "itemId"
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        );

        -- Insert PayInBolt11 records for zaps with invoices
        INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight")
        SELECT "invoice_created_at", "invoice_updated_at", map.payin_id, "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight"
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        WHERE "hash" IS NOT NULL;

        -- Insert PayOutBolt11 records for zaps with withdrawals
        INSERT INTO "PayOutBolt11" (created_at, updated_at, "payOutType", "hash", "preimage",
            "bolt11", "msats", "status", "userId", "payInId", "protocolId")
        SELECT "withdrawal_created_at", "withdrawal_updated_at", 'ZAP', "withdrawal_hash", "withdrawal_preimage",
            "forward_bolt11", "msatsPaying", "withdrawal_status", "userId", map.payin_id, "protocolId"
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        WHERE "withdrawal_hash" IS NOT NULL;

        -- Insert PayInCustodialToken records for zaps without invoices
        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
        SELECT map.payin_id, "msats", get_custodial_token_type(zaps."created_at")
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        WHERE "hash" IS NULL;

        -- Insert routing fee PayOutCustodialToken records for withdrawals
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT "withdrawal_created_at", "withdrawal_updated_at", "userId", map.payin_id,
            COALESCE("msatsFeePaid", "msatsFeePaying"), 'SATS', 'ROUTING_FEE'
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        WHERE "withdrawal_hash" IS NOT NULL;

        -- Insert rewards pool PayOutCustodialToken records for withdrawals
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT "invoice_created_at", "invoice_updated_at", 9513, map.payin_id,
            "msatsRequested" - COALESCE("msatsFeePaid", "msatsFeePaying") - COALESCE("msatsPaid", "msatsPaying"), 'SATS', 'REWARDS_POOL'
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        WHERE "withdrawal_hash" IS NOT NULL;

        -- Insert referral act payouts (for fees)
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT zaps."created_at", zaps."created_at", ref."referrerId", map.payin_id, ref."msats", 'SATS', 'DEFUNCT_REFERRAL_ACT'
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        JOIN zap_referral_acts_batch ref ON (
            ref."itemId" = zaps."itemId" AND
            ref."userId" = zaps."userId" AND
            ref."created_at" = zaps."created_at" AND
            ref."invoiceId" = COALESCE(zaps."invoiceId", 0)
        )
        WHERE zaps."withdrawal_hash" IS NULL AND ref."referrerId" <> zaps."targetUserId";

        -- Insert forward payouts (for tips)
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT zaps."created_at", zaps."created_at", fwd."forward_user_id", map.payin_id,
            fwd."pct" * zaps."tipMsats" / 100, get_custodial_token_type(zaps."created_at"), 'ZAP'
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        JOIN zap_forwards_batch fwd ON (
            fwd."itemId" = zaps."itemId" AND
            fwd."userId" = zaps."userId" AND
            fwd."created_at" = zaps."created_at" AND
            fwd."invoiceId" = COALESCE(zaps."invoiceId", 0)
        )
        WHERE zaps."withdrawal_hash" IS NULL AND (fwd."pct" * zaps."tipMsats" / 100) > 0;

        -- Insert remaining tip amount to target user
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT zaps."created_at", zaps."created_at", zaps."targetUserId", map.payin_id,
            zaps."tipMsats" - COALESCE(forward_total.total, 0), get_custodial_token_type(zaps."created_at"), 'ZAP'
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (
            map.item_id = zaps."itemId" AND
            map.user_id = zaps."userId" AND
            map.created_at = zaps."created_at" AND
            map.invoice_id = COALESCE(zaps."invoiceId", 0)
        )
        LEFT JOIN (
            SELECT fwd."itemId", fwd."userId", fwd."created_at", fwd."invoiceId",
                   sum(fwd."pct" * zaps."tipMsats" / 100) AS total
            FROM zap_forwards_batch fwd
            JOIN item_act_zaps_batch zaps ON (fwd."itemId", fwd."userId", fwd."created_at", fwd."invoiceId") =
                                           (zaps."itemId", zaps."userId", zaps."created_at", COALESCE(zaps."invoiceId", 0))
            WHERE (fwd."pct" * zaps."tipMsats" / 100) > 0
            GROUP BY fwd."itemId", fwd."userId", fwd."created_at", fwd."invoiceId"
        ) forward_total ON (forward_total."itemId", forward_total."userId", forward_total."created_at", forward_total."invoiceId") =
                           (zaps."itemId", zaps."userId", zaps."created_at", COALESCE(zaps."invoiceId", 0))
        WHERE zaps."withdrawal_hash" IS NULL;

        -- Insert remaining fee amount to rewards pool
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT zaps."created_at", zaps."created_at", 9513, map.payin_id,
            zaps."feeMsats" - COALESCE(referral_total.total, 0), 'SATS', 'REWARDS_POOL'
        FROM item_act_zaps_batch zaps
        JOIN map_zap_payin_batch map ON (map.item_id, map.user_id, map.created_at, map.invoice_id) =
                                       (zaps."itemId", zaps."userId", zaps."created_at", COALESCE(zaps."invoiceId", 0))
        LEFT JOIN (
            SELECT ref."itemId", ref."userId", ref."created_at", ref."invoiceId", sum(ref."msats") AS total
            FROM zap_referral_acts_batch ref
            JOIN item_act_zaps_batch zaps ON (ref."itemId", ref."userId", ref."created_at", ref."invoiceId") =
                                           (zaps."itemId", zaps."userId", zaps."created_at", COALESCE(zaps."invoiceId", 0))
            WHERE ref."referrerId" <> zaps."targetUserId"
            GROUP BY ref."itemId", ref."userId", ref."created_at", ref."invoiceId"
        ) referral_total ON (referral_total."itemId", referral_total."userId", referral_total."created_at", referral_total."invoiceId") =
                            (zaps."itemId", zaps."userId", zaps."created_at", COALESCE(zaps."invoiceId", 0))
        WHERE zaps."withdrawal_hash" IS NULL;

        -- Update offset for next batch
        min_id := min_id + batch_size;
        batch_num := batch_num + 1;
    END LOOP;

    -- Clean up
    DROP TABLE IF EXISTS item_act_zaps_batch;
    DROP TABLE IF EXISTS zap_referral_acts_batch;
    DROP TABLE IF EXISTS zap_forwards_batch;
    DROP TABLE IF EXISTS map_zap_payin_batch;

    RAISE LOG 'Completed zap migration in % batches', batch_num - 1;
END $$;

-- Drop temporary covering indexes after zap migration
DROP INDEX IF EXISTS "ItemAct_zap_covering_idx";
DROP INDEX IF EXISTS "Item_userId_covering_idx";
DROP INDEX IF EXISTS "Invoice_covering_zap_idx";
DROP INDEX IF EXISTS "InvoiceForward_covering_zap_idx";
DROP INDEX IF EXISTS "Withdrawl_covering_zap_idx";
DROP INDEX IF EXISTS "ReferralAct_zap_idx";
DROP INDEX IF EXISTS "ItemForward_zap_idx";

----------------------------------------------
---Item Act: BOOST, DONT_LIKE_THIS, POLL -----
----------------------------------------------

-- Batched boost/poll migration to handle large datasets
DO $$
DECLARE
    batch_size INTEGER := 30000;
    offset_val INTEGER := 0;
    rows_processed INTEGER;
    batch_num INTEGER := 1;
    max_id INTEGER;
BEGIN
    -- Get max ItemAct ID for progress tracking
    SELECT COALESCE(MAX("id"), 0) INTO max_id
    FROM "ItemAct"
    WHERE "act" IN ('BOOST', 'DONT_LIKE_THIS', 'POLL');

    RAISE LOG 'Processing % total boost/poll acts in batches of %', max_id, batch_size;

    -- Create persistent temp tables
    DROP TABLE IF EXISTS item_act_boost_poll_batch;
    DROP TABLE IF EXISTS boost_poll_referral_acts_batch;
    DROP TABLE IF EXISTS map_boost_poll_payin_batch;

    CREATE TEMP TABLE item_act_boost_poll_batch (
        id INTEGER PRIMARY KEY,
        "itemId" INTEGER,
        "userId" INTEGER,
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "msats" BIGINT,
        "act" TEXT,
        "invoiceId" INTEGER,
        hash TEXT,
        preimage TEXT,
        bolt11 TEXT,
        "expiresAt" TIMESTAMP,
        "confirmedAt" TIMESTAMP,
        "confirmedIndex" INTEGER,
        "cancelledAt" TIMESTAMP,
        "msatsRequested" BIGINT,
        "msatsReceived" BIGINT,
        "actionState" TEXT,
        invoice_created_at TIMESTAMP,
        invoice_updated_at TIMESTAMP
    );

    CREATE TEMP TABLE boost_poll_referral_acts_batch (
        item_act_id INTEGER,
        "referrerId" INTEGER,
        "msats" BIGINT
    );

    CREATE TEMP TABLE map_boost_poll_payin_batch (
        item_act_id INTEGER PRIMARY KEY,
        payin_id INTEGER NOT NULL
    );

    LOOP
        RAISE LOG 'Processing boost/poll batch % (IDs % to %)', batch_num, offset_val + 1, offset_val + batch_size;

        -- Clear batch tables
        TRUNCATE item_act_boost_poll_batch;
        TRUNCATE boost_poll_referral_acts_batch;
        TRUNCATE map_boost_poll_payin_batch;

        -- Load next batch
        INSERT INTO item_act_boost_poll_batch
        SELECT "ItemAct".id, "ItemAct"."itemId", "ItemAct"."userId", "ItemAct"."created_at", "ItemAct"."updated_at",
               "ItemAct"."msats", "ItemAct"."act", "ItemAct"."invoiceId",
               "Invoice"."hash", "Invoice"."preimage", "Invoice"."bolt11", "Invoice"."expiresAt",
               "Invoice"."confirmedAt", "Invoice"."confirmedIndex", "Invoice"."cancelledAt",
               "Invoice"."msatsRequested", "Invoice"."msatsReceived", "Invoice"."actionState",
               "Invoice"."created_at" AS invoice_created_at, "Invoice"."updated_at" AS invoice_updated_at
        FROM "ItemAct"
        LEFT JOIN "Invoice" ON "Invoice"."id" = "ItemAct"."invoiceId"
        WHERE "ItemAct"."act" IN ('BOOST', 'DONT_LIKE_THIS', 'POLL')
          AND "ItemAct".id > offset_val
        ORDER BY "ItemAct".id
        LIMIT batch_size;

        GET DIAGNOSTICS rows_processed = ROW_COUNT;
        EXIT WHEN rows_processed = 0;

        -- Load referral acts for this batch
        INSERT INTO boost_poll_referral_acts_batch
        SELECT acts.id AS item_act_id, "ReferralAct"."referrerId", "ReferralAct"."msats"
        FROM item_act_boost_poll_batch acts
        JOIN "ReferralAct" ON "ReferralAct"."itemActId" = acts.id
        WHERE "ReferralAct"."msats" > 0;

        -- Create indexes for this batch
        DROP INDEX IF EXISTS item_act_boost_poll_batch_id_idx;
        DROP INDEX IF EXISTS item_act_boost_poll_batch_hash_idx;
        CREATE UNIQUE INDEX item_act_boost_poll_batch_id_idx ON item_act_boost_poll_batch (id);
        CREATE UNIQUE INDEX item_act_boost_poll_batch_hash_idx ON item_act_boost_poll_batch (hash);
        ANALYZE item_act_boost_poll_batch;

        -- Insert PayIn records for this batch
        WITH boost_poll_payin_prospect AS (
            SELECT item_act_boost_poll_batch.*, nextval(pg_get_serial_sequence('"PayIn"', 'id')) AS payin_id
            FROM item_act_boost_poll_batch
        ), insert_payin AS (
            INSERT INTO "PayIn" (id, created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
            SELECT payin_id,
                   "created_at",
                   COALESCE("confirmedAt", "invoice_updated_at", "created_at"),
                   "msats",
                   CASE
                       WHEN "act" = 'BOOST' THEN 'BOOST'::"PayInType"
                       WHEN "act" = 'DONT_LIKE_THIS' THEN 'DOWN_ZAP'::"PayInType"
                       WHEN "act" = 'POLL' THEN 'POLL_VOTE'::"PayInType"
                   END,
                   CASE WHEN "confirmedAt" IS NOT NULL THEN 'PAID'::"PayInState" ELSE 'FAILED'::"PayInState" END,
                   COALESCE("confirmedAt", "invoice_updated_at", "created_at"),
                   "userId"
            FROM boost_poll_payin_prospect
        )
        INSERT INTO map_boost_poll_payin_batch (item_act_id, payin_id)
        SELECT id, payin_id FROM boost_poll_payin_prospect;

        -- Insert ItemPayIn records
        INSERT INTO "ItemPayIn" ("payInId", "itemId")
        SELECT map_boost_poll_payin_batch.payin_id, "itemId"
        FROM item_act_boost_poll_batch
        JOIN map_boost_poll_payin_batch ON map_boost_poll_payin_batch.item_act_id = item_act_boost_poll_batch.id;

        -- Insert PayInBolt11 records for items with invoices
        INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId")
        SELECT "invoice_created_at", "invoice_updated_at", map_boost_poll_payin_batch.payin_id, "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId"
        FROM item_act_boost_poll_batch
        JOIN map_boost_poll_payin_batch ON map_boost_poll_payin_batch.item_act_id = item_act_boost_poll_batch.id
        WHERE "hash" IS NOT NULL;

        -- Insert PayInCustodialToken records for items without invoices
        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
        SELECT map_boost_poll_payin_batch.payin_id, "msats", get_custodial_token_type("created_at")
        FROM item_act_boost_poll_batch
        JOIN map_boost_poll_payin_batch ON map_boost_poll_payin_batch.item_act_id = item_act_boost_poll_batch.id
        WHERE "hash" IS NULL;

        -- Insert referral act payouts
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT acts."created_at", acts."created_at", ref."referrerId", map_boost_poll_payin_batch.payin_id, ref."msats", 'SATS', 'DEFUNCT_REFERRAL_ACT'
        FROM item_act_boost_poll_batch acts
        JOIN map_boost_poll_payin_batch ON map_boost_poll_payin_batch.item_act_id = acts.id
        JOIN boost_poll_referral_acts_batch ref ON ref.item_act_id = acts.id;

        -- Insert remaining amount to rewards pool
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT acts."created_at", acts."created_at", 9513, map_boost_poll_payin_batch.payin_id,
            acts."msats" - COALESCE(referral_total.total, 0), 'SATS', 'REWARDS_POOL'
        FROM item_act_boost_poll_batch acts
        JOIN map_boost_poll_payin_batch ON map_boost_poll_payin_batch.item_act_id = acts.id
        LEFT JOIN (
            SELECT ref.item_act_id, sum(ref."msats") AS total
            FROM boost_poll_referral_acts_batch ref
            GROUP BY ref.item_act_id
        ) referral_total ON referral_total.item_act_id = acts.id
        WHERE acts."msats" - COALESCE(referral_total.total, 0) > 0;

        -- Update offset for next batch
        SELECT MAX(id) INTO offset_val FROM item_act_boost_poll_batch;
        batch_num := batch_num + 1;
    END LOOP;

    -- Clean up
    DROP TABLE IF EXISTS item_act_boost_poll_batch;
    DROP TABLE IF EXISTS boost_poll_referral_acts_batch;
    DROP TABLE IF EXISTS map_boost_poll_payin_batch;

    RAISE LOG 'Completed boost/poll migration in % batches', batch_num - 1;
END $$;

-- Re-enable autovacuum and manually vacuum important tables
ALTER TABLE "PayIn" SET (autovacuum_enabled = true);
ALTER TABLE "PayInCustodialToken" SET (autovacuum_enabled = true);
ALTER TABLE "PayInBolt11" SET (autovacuum_enabled = true);
ALTER TABLE "PayOutCustodialToken" SET (autovacuum_enabled = true);
ALTER TABLE "PayOutBolt11" SET (autovacuum_enabled = true);
ALTER TABLE "ItemPayIn" SET (autovacuum_enabled = true);