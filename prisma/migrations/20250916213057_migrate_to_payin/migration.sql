-- todo: we can do a better job of representing territory revenue in these migrations
-- we're currently dumping it all into a rewards pool payoutcustodialtoken

-- there are also lots of tables and columns that could be the subject of deletion
-- however, it's probably better to leave them in place just in case we make a mistake
-- migrating.

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

-------------------
------INVITES------
-------------------

-- create a postgres function to migrate invites in a loop, because we can't maintain some of the relationships
-- using a CTE
CREATE OR REPLACE FUNCTION migrate_invites()
RETURNS VOID AS $$
DECLARE
    invite RECORD;
    payin_id INTEGER;
BEGIN
    -- for all invited users with their invite, create a payin, payincustodialtoken, and payoutcustodialtoken
    FOR invite IN SELECT users.id AS "invitedUserId", users.created_at AS "invitedAt", "Invite".*
    FROM users
    JOIN "Invite" ON "Invite"."id" = "users"."inviteId"
    WHERE users."inviteId" IS NOT NULL
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT invite."invitedAt", invite."invitedAt", invite.gift * 1000,  'INVITE_GIFT', 'PAID', invite."invitedAt", invite."userId"
        RETURNING id INTO payin_id;

        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType")
        SELECT payin_id, invite.gift * 1000, get_custodial_token_type(invite."invitedAt");

        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        SELECT invite."invitedAt", invite."invitedAt", invite."invitedUserId", payin_id, invite.gift * 1000, get_custodial_token_type(invite."invitedAt"), 'INVITE_GIFT';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- call the function
SELECT migrate_invites();
DROP FUNCTION migrate_invites();

--------------------
------DONATIONS-----
--------------------

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

CREATE OR REPLACE FUNCTION migrate_withdrawls()
RETURNS VOID AS $$
DECLARE
    withdrawl "Withdrawl";
    payin_id INTEGER;
BEGIN
    -- for all withdrawls without an invoice forward, create a payin, payincustodialtoken, payoutbolt11, and payoutcustodialtoken
    FOR withdrawl IN
        SELECT "Withdrawl".*
        FROM "Withdrawl"
        LEFT JOIN "InvoiceForward" ON "InvoiceForward"."withdrawlId" = "Withdrawl"."id"
        WHERE "InvoiceForward"."withdrawlId" IS NULL
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT withdrawl."created_at", withdrawl."updated_at", withdrawl."msatsPaying" + withdrawl."msatsFeePaying",
            CASE WHEN withdrawl."autoWithdraw" THEN 'AUTO_WITHDRAWAL' ELSE 'WITHDRAWAL' END::"PayInType",
            CASE WHEN withdrawl."status" = 'CONFIRMED' THEN 'PAID' WHEN withdrawl."status" IS NULL THEN 'PENDING_WITHDRAWAL' ELSE 'FAILED' END::"PayInState",
            withdrawl."created_at", withdrawl."userId"
        RETURNING id INTO payin_id;

        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType") VALUES (payin_id, withdrawl."msatsPaying" + withdrawl."msatsFeePaying", 'SATS');

        INSERT INTO "PayOutBolt11" (created_at, updated_at, "payOutType", "hash", "preimage", "bolt11", "msats", "status", "userId", "payInId", "protocolId")
        VALUES (withdrawl."created_at", withdrawl."updated_at", 'WITHDRAWAL', withdrawl."hash", withdrawl."preimage", withdrawl."bolt11",
            COALESCE(withdrawl."msatsPaid", withdrawl."msatsPaying"), withdrawl."status", withdrawl."userId", payin_id, withdrawl."protocolId");

        -- the reserved routing fee
        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
            VALUES (withdrawl."created_at", withdrawl."updated_at", NULL, payin_id, withdrawl."msatsFeePaying", 'SATS', 'ROUTING_FEE');

        -- the actual routing fee and refund
        IF withdrawl."status" = 'CONFIRMED' AND withdrawl."msatsFeePaid" < withdrawl."msatsFeePaying" THEN
            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
            VALUES (withdrawl."created_at", withdrawl."updated_at", withdrawl."userId", payin_id, withdrawl."msatsFeePaying" - withdrawl."msatsFeePaid", 'SATS', 'ROUTING_FEE_REFUND');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- call the function
SELECT migrate_withdrawls();
DROP FUNCTION migrate_withdrawls();

--------------------
------SUBACTS-------
--------------------

CREATE OR REPLACE FUNCTION migrate_subacts()
RETURNS VOID AS $$
DECLARE
    subact RECORD;
    payin_id INTEGER;
    payoutcustodialtoken_id INTEGER;
BEGIN
    -- for all subacts, create a payin, payincustodialtoken, and payoutcustodialtoken
    -- like with donations, we don't know the funding source exactly - it could've been a pessimistic invoice
    -- or custodial tokens, so we assume it was custodial tokens, then for those invoices we'll create a
    -- BUY_CREDITS payin
    FOR subact IN SELECT "SubAct".*, "Sub"."created_at" AS "subCreatedAt"
    FROM "SubAct"
    JOIN "Sub" ON "Sub"."name" = "SubAct"."subName"
    WHERE "SubAct"."type" = 'BILLING'
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT subact."created_at", subact."updated_at", subact."msats",
            -- we don't check for updates or unarchives because those are relatively hard to detect
            CASE WHEN subact."created_at" > subact."subCreatedAt" THEN 'TERRITORY_BILLING'::"PayInType" ELSE 'TERRITORY_CREATE'::"PayInType" END,
            'PAID', subact."created_at", subact."userId"
        RETURNING id INTO payin_id;

        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType") VALUES (payin_id, subact."msats", get_custodial_token_type(subact."created_at"));
        INSERT INTO "SubPayIn" ("payInId", "subName") VALUES (payin_id, subact."subName");

        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        VALUES (subact."created_at", subact."updated_at", 4502, payin_id, subact."msats", 'SATS', 'SYSTEM_REVENUE');
    END LOOP;

    FOR subact IN SELECT "SubAct".*
    FROM "SubAct"
    WHERE "SubAct"."type" = 'REVENUE'
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT subact."created_at", subact."updated_at", subact."msats", 'DEFUNCT_TERRITORY_DAILY_PAYOUT', 'PAID', subact."created_at", 9513
        RETURNING id INTO payin_id;

        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType") VALUES (payin_id, subact."msats", 'SATS');

        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        VALUES (subact."created_at", subact."updated_at", subact."userId", payin_id, subact."msats", 'SATS', 'TERRITORY_REVENUE')
        RETURNING id INTO payoutcustodialtoken_id;

        INSERT INTO "SubPayOutCustodialToken" ("payOutCustodialTokenId", "subName") VALUES (payoutcustodialtoken_id, subact."subName");
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- call the function
SELECT migrate_subacts();
DROP FUNCTION migrate_subacts();

--------------------
------EARN----------
--------------------

--- this is tricky ... we'll need to group by day and user
--- each day will be its own payin, and each user for that day will be its own payoutcustodialtoken
--- which must be associated with the earn rows

CREATE OR REPLACE FUNCTION migrate_earns()
RETURNS VOID AS $$
DECLARE
    earn RECORD;
    user_earning RECORD;
    payin_id INTEGER;
    payoutcustodialtoken_id INTEGER;
BEGIN
    -- for all rewards, create a payin, payincustodialtoken, and payoutcustodialtoken
    FOR earn IN
        WITH earns AS (
            SELECT sum("msats") AS "msats", "created_at", "userId"
            FROM "Earn"
            GROUP BY "Earn"."created_at", "Earn"."userId"
        )
        SELECT sum("msats") AS "msats", "created_at", json_agg(json_build_object('userId', "userId", 'msats', "msats")) AS "user_earnings"
        FROM earns
        WHERE "msats" > 0
        GROUP BY "created_at"
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT earn."created_at", earn."created_at", earn."msats", 'REWARDS', 'PAID', earn."created_at", 9513
        RETURNING id INTO payin_id;

        INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType") VALUES (payin_id, earn."msats", 'SATS');

        FOR user_earning IN SELECT * FROM json_to_recordset(earn."user_earnings") AS x("userId" INTEGER, msats BIGINT)
        LOOP
            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
            VALUES (earn."created_at", earn."created_at", user_earning."userId", payin_id, user_earning."msats", 'SATS', 'REWARD')
            RETURNING id INTO payoutcustodialtoken_id;

            UPDATE "Earn" SET "payOutCustodialTokenId" = payoutcustodialtoken_id WHERE "userId" = user_earning."userId" AND "created_at" = earn."created_at";
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_earns();
DROP FUNCTION migrate_earns();

--------------------------
-----INVOICE: RECEIVE-----
--------------------------

-- we only deal with these in a terminal state, so we should probably cancel anything pending before migrating
CREATE OR REPLACE FUNCTION migrate_invoice_receives()
RETURNS VOID AS $$
DECLARE
    receive RECORD;
    payin_id INTEGER;
    payin_bolt11_id INTEGER;
    payoutcustodialtoken_id INTEGER;
BEGIN
    FOR receive IN
        SELECT to_jsonb("Invoice".*) AS "invoice", to_jsonb("InvoiceForward".*) AS "forward", to_jsonb("Withdrawl".*) AS "withdrawal"
        FROM "Invoice"
        JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
        LEFT JOIN "Withdrawl" ON "Withdrawl"."id" = "InvoiceForward"."withdrawlId"
        WHERE "Invoice"."actionType" = 'RECEIVE' AND "Invoice"."actionState" IN ('PAID', 'FAILED', 'RETRYING')
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT receive.invoice->>'created_at', receive.invoice->>'updated_at', receive.invoice->>'msatsRequested',
            'PROXY_PAYMENT', CASE WHEN receive.invoice->>'payInState' = 'PAID' THEN 'PAID'::"PayInState" ELSE 'FAILED'::"PayInState" END,
            receive.invoice->>'updated_at', receive.invoice->>'userId'
        RETURNING id INTO payin_id;

        INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
            "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
            "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight")
        SELECT receive.invoice->>'created_at', receive.invoice->>'updated_at', payin_id, receive.invoice->>'hash', receive.invoice->>'preimage',
            receive.invoice->>'bolt11', receive.invoice->>'expiresAt', receive.invoice->>'confirmedAt', receive.invoice->>'confirmedIndex', receive.invoice->>'cancelledAt',
            receive.invoice->>'msatsRequested', receive.invoice->>'msatsReceived', receive.invoice->>'userId', receive.forward->>'expiryHeight', receive.forward->>'acceptHeight'
        RETURNING id INTO payin_bolt11_id;

        IF receive.invoice->>'comment' IS NOT NULL THEN
            INSERT INTO "PayInBolt11Comment" ("payInBolt11Id", "comment")
            VALUES (payin_bolt11_id, receive.invoice->>'comment');
        END IF;

        IF receive.invoice->>'lud18Data' IS NOT NULL THEN
            INSERT INTO "PayInBolt11Lud18" ("payInBolt11Id", "name", "identifier", "email", "pubkey")
            VALUES (payin_bolt11_id, receive.invoice->>'lud18Data'->>'name', receive.invoice->>'lud18Data'->>'identifier',
                receive.invoice->>'lud18Data'->>'email', receive.invoice->>'lud18Data'->>'pubkey');
        END IF;

        IF receive.invoice->>'desc' IS JSON THEN
            INSERT INTO "PayInNostrNote" ("payInBolt11Id", "note")
            VALUES (payin_bolt11_id, receive.invoice->>'desc');
        END IF;

        IF receive.withdrawal IS NOT NULL THEN
            INSERT INTO "PayOutBolt11" (created_at, updated_at, "payOutType", "hash", "preimage",
                "bolt11", "msats", "status", "userId",
                "payInId", "protocolId")
            VALUES (receive.invoice->>'created_at', receive.invoice->>'updated_at', 'PROXY_PAYMENT', receive.withdrawal->>'hash', receive.withdrawal->>'preimage',
                receive.forward->>'bolt11', receive.withdrawal->>'msatsPaying', receive.withdrawal->>'status', receive.withdrawal->>'userId',
                payin_id, receive.withdrawal->>'protocolId');

            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
            VALUES (receive.withdrawal->>'created_at', receive.withdrawal->>'updated_at', receive.withdrawal->>'userId', payin_id,
                COALESCE(receive.withdrawal->>'msatsFeePaid', receive.withdrawal->>'msatsFeePaying'), 'SATS', 'ROUTING_FEE');

            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
            VALUES (receive.invoice->>'created_at', receive.invoice->>'updated_at', 9513, payin_id, receive.invoice->>'msatsRequested' -
                COALESCE(receive.withdrawal->>'msatsFeePaid', receive.withdrawal->>'msatsFeePaying') - COALESCE(receive.withdrawal->>'msatsPaid', receive.withdrawal->>'msatsPaying'), 'SATS', 'REWARDS_POOL');
        ELSE
            -- because withdrawals are not always created when failures occur before forwarding, we create a properly sized
            -- output in the place of the withdrawal
            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
            VALUES (receive.invoice->>'created_at', receive.invoice->>'updated_at', 9513, payin_id, receive.invoice->>'msatsRequested',
                'SATS', 'REWARDS_POOL');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_invoice_receives();
DROP FUNCTION migrate_invoice_receives();

--------------------------
---INVOICE: Pessimistic---
--------------------------

-- basically any invoice that is not associated with item create, or item acts, we want to record as a buy credits payin

CREATE OR REPLACE FUNCTION migrate_invoice_pessimistic()
RETURNS VOID AS $$
DECLARE
    invoice RECORD;
    payin_id INTEGER;
BEGIN
    FOR invoice IN
        SELECT "Invoice".*
        FROM "Invoice"
        LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
        WHERE "InvoiceForward".id IS NULL AND (
            "Invoice"."actionType" IS NULL OR
            "Invoice"."actionType" IN ('BUY_CREDITS', 'ITEM_UPDATE', 'DONATE', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE')
        )
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT invoice."created_at", invoice."updated_at", COALESCE(invoice."msatsReceived",invoice."msatsRequested"), 'BUY_CREDITS',
            CASE WHEN invoice."confirmedAt" IS NOT NULL THEN 'PAID'::"PayInState" ELSE 'FAILED'::"PayInState" END,
            invoice."updated_at", invoice."userId"
        RETURNING id INTO payin_id;

        INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
        VALUES (invoice."created_at", invoice."updated_at", invoice."userId", payin_id, COALESCE(invoice."msatsReceived",invoice."msatsRequested"), get_custodial_token_type(invoice."created_at"), 'BUY_CREDITS');
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_invoice_pessimistic();
DROP FUNCTION migrate_invoice_pessimistic();

--------------------------
-------Item Create--------
--------------------------

-- no matter if the item is free or not, we want to record it as a item create payin
-- if there's an invoice associated with the item create, we want to record that as a payinbolt11
-- we can determine the cost of the item create by looking at the item act table
-- we also want to associate any uploads with the item create
-- if we do this right, this can also encapsulate item update


CREATE OR REPLACE FUNCTION migrate_item_create()
RETURNS VOID AS $$
DECLARE
    item RECORD;
    payin_id INTEGER;
    payin_bolt11_id INTEGER;
    custodial_mtokens BIGINT;
BEGIN
    FOR item IN
        SELECT "Item".*, to_jsonb("Invoice".*) AS "invoice", to_jsonb("ItemUploads".*) AS "uploads", to_jsonb("ItemActs".*) AS "itemacts"
        FROM "Item"
        LEFT JOIN "Invoice" ON "Invoice".id = "Item"."invoiceId"
        LEFT JOIN LATERAL (SELECT array_agg("uploadId") AS "ids" FROM "ItemUpload" WHERE "ItemUpload"."itemId" = "Item"."id" GROUP BY "ItemUpload"."itemId") AS "ItemUploads" ON TRUE
        LEFT JOIN LATERAL (SELECT sum("msats") AS "msats" FROM "ItemAct" WHERE "ItemAct"."itemId" = "Item"."id" AND "ItemAct"."act" = 'FEE' AND "ItemAct"."userId" = "Item"."userId" GROUP BY "ItemAct"."itemId") AS "ItemActs" ON TRUE
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT item."created_at", COALESCE((item.invoice->>'confirmedAt')::timestamp, (item.invoice->>'updated_at')::timestamp, item."created_at"), COALESCE((item.itemacts->>'msats')::bigint, 0), 'ITEM_CREATE'::"PayInType",
            CASE WHEN item."invoiceActionState" IS NULL OR item."invoiceActionState" = 'PAID' THEN 'PAID'::"PayInState" ELSE 'FAILED'::"PayInState" END,
            COALESCE((item.invoice->>'confirmedAt')::timestamp, (item.invoice->>'updated_at')::timestamp, item."created_at"), item."userId"
        RETURNING id INTO payin_id;

        INSERT INTO "ItemPayIn" ("payInId", "itemId") VALUES (payin_id, item."id");

        IF item.invoice IS NOT NULL THEN
            INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
                "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
                "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight")
            VALUES (item.invoice->>'created_at', item.invoice->>'updated_at', payin_id, item.invoice->>'hash', item.invoice->>'preimage',
                item.invoice->>'bolt11', item.invoice->>'expiresAt', item.invoice->>'confirmedAt', item.invoice->>'confirmedIndex', item.invoice->>'cancelledAt',
                item.invoice->>'msatsRequested', item.invoice->>'msatsReceived', item.invoice->>'userId', item.invoice->>'expiryHeight', item.invoice->>'acceptHeight');
        END IF;

        custodial_mtokens := (item.itemacts->>'msats')::bigint - COALESCE((item.invoice->>'msatsRequested')::bigint, 0);

        IF custodial_mtokens > 0 THEN
            INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType") VALUES (payin_id, custodial_mtokens, get_custodial_token_type(item.created_at));
        END IF;

        IF item.uploads IS NOT NULL THEN
            INSERT INTO "PayInUpload" ("payInId", "uploadId")
            SELECT payin_id, *
            FROM UNNEST(item.uploads->>'ids') AS "uploadId"
            ON CONFLICT DO NOTHING;
        END IF;

        IF (item.itemacts->>'msats')::bigint > 0 THEN
            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
            VALUES (item."created_at", item."created_at", 9513, payin_id, (item.itemacts->>'msats')::bigint, 'SATS', 'REWARDS_POOL');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_item_create();
DROP FUNCTION migrate_item_create();

--------------------------
-------Item Act: ZAPS-----
--------------------------

CREATE OR REPLACE FUNCTION migrate_item_act_zaps()
RETURNS VOID AS $$
DECLARE
    item_act RECORD;
    payin_id INTEGER;
    referral_act RECORD;
    forward RECORD;
    remaining_tip_msats BIGINT := 0;
    remaining_fee_msats BIGINT := 0;
BEGIN
    FOR item_act IN
        WITH zaps AS (
            SELECT "ItemAct"."itemId", "ItemAct"."userId", "ItemAct"."created_at", "ItemAct"."invoiceId", sum("ItemAct"."msats") AS "msats",
                sum(CASE WHEN "ItemAct"."act" = 'TIP' THEN "ItemAct"."msats" ELSE 0 END) AS "tipMsats",
                sum(CASE WHEN "ItemAct"."act" = 'FEE' THEN "ItemAct"."msats" ELSE 0 END) AS "feeMsats",
                max("ItemAct"."id") FILTER(WHERE "ItemAct"."act" = 'FEE') AS "feeId",
                "Item"."userId" AS "targetUserId"
            FROM "ItemAct"
            JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
            WHERE "ItemAct"."act" IN ('TIP', 'FEE') AND "ItemAct"."userId" <> "Item"."userId"
            GROUP BY "ItemAct"."itemId", "ItemAct"."userId", "ItemAct"."created_at", "ItemAct"."invoiceId", "Item"."userId"
        ), zaps_with_etc AS (
            SELECT zaps.*, json_agg(json_build_object('referrerId', "ReferralAct"."referrerId", 'msats', "ReferralAct"."msats")) AS "referral_acts",
                json_agg(json_build_object('userId', "ItemForward"."userId", 'pct', "ItemForward"."pct")) AS "forwards"
            FROM zaps
            LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = zaps."feeId"
            LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = zaps."itemId"
            GROUP BY zaps."itemId", zaps."userId", zaps."feeId", zaps."created_at", zaps."invoiceId", zaps."msats", zaps."tipMsats", zaps."feeMsats", zaps."targetUserId"
        )
        SELECT zaps_with_etc.*, to_jsonb("Invoice".*) AS "invoice", to_jsonb("InvoiceForward".*) AS "forward", to_jsonb("Withdrawl".*) AS "withdrawal"
        FROM zaps_with_etc
        LEFT JOIN "Invoice" ON "Invoice".id = "zaps_with_etc"."invoiceId"
        LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id"
        LEFT JOIN "Withdrawl" ON "Withdrawl"."id" = "InvoiceForward"."withdrawlId"
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT item_act."created_at", COALESCE((item_act.invoice->>'confirmedAt')::timestamp, (item_act.invoice->>'updated_at')::timestamp, item_act."created_at"), item_act."msats",
            'ZAP', CASE WHEN item_act.invoice->>'confirmedAt' IS NOT NULL THEN 'PAID'::"PayInState" ELSE 'FAILED'::"PayInState" END,
            COALESCE((item_act.invoice->>'confirmedAt')::timestamp, (item_act.invoice->>'updated_at')::timestamp, item_act."created_at"), item_act."userId"
        RETURNING id INTO payin_id;

        INSERT INTO "ItemPayIn" ("payInId", "itemId") VALUES (payin_id, item_act."itemId");

        IF item_act.invoice IS NOT NULL THEN
            INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
                "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
                "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight")
            VALUES (item_act.invoice->>'created_at', item_act.invoice->>'updated_at', payin_id, item_act.invoice->>'hash', item_act.invoice->>'preimage',
                item_act.invoice->>'bolt11', item_act.invoice->>'expiresAt', item_act.invoice->>'confirmedAt', item_act.invoice->>'confirmedIndex', item_act.invoice->>'cancelledAt',
                item_act.invoice->>'msatsRequested', item_act.invoice->>'msatsReceived', item_act.invoice->>'userId', item_act.forward->>'expiryHeight', item_act.forward->>'acceptHeight');

            IF item_act.withdrawal IS NOT NULL THEN
                INSERT INTO "PayOutBolt11" (created_at, updated_at, "payOutType", "hash", "preimage",
                    "bolt11", "msats", "status", "userId",
                    "payInId", "protocolId")
                VALUES (item_act.withdrawal->>'created_at', item_act.withdrawal->>'updated_at', 'ZAP', item_act.withdrawal->>'hash', item_act.withdrawal->>'preimage',
                    item_act.forward->>'bolt11', item_act.withdrawal->>'msatsPaying', item_act.withdrawal->>'status', item_act.withdrawal->>'userId',
                    payin_id, item_act.withdrawal->>'protocolId');

                INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                    VALUES (item_act.withdrawal->>'created_at', item_act.withdrawal->>'updated_at', item_act.withdrawal->>'userId', payin_id,
                        COALESCE(item_act.withdrawal->>'msatsFeePaid', item_act.withdrawal->>'msatsFeePaying'), 'SATS', 'ROUTING_FEE');

                INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                    VALUES (item_act.invoice->>'created_at', item_act.invoice->>'updated_at', 9513, payin_id, item_act.invoice->>'msatsRequested' -
                        COALESCE(item_act.withdrawal->>'msatsFeePaid', item_act.withdrawal->>'msatsFeePaying') - COALESCE(item_act.withdrawal->>'msatsPaid', item_act.withdrawal->>'msatsPaying'), 'SATS', 'REWARDS_POOL');
            END IF;
        ELSE
            INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType") VALUES (payin_id, item_act."msats", get_custodial_token_type(item_act."created_at"));
        END IF;

        IF item_act.withdrawal IS NULL THEN
            remaining_tip_msats := item_act."tipMsats";
            remaining_fee_msats := item_act."feeMsats";
            -- need to split tipMsats between the targetUserId and forwards
            -- we need to split feeMsats between the rewards pool and the referrerId
            FOR referral_act IN SELECT * FROM json_to_recordset(item_act.referral_acts) AS x("referrerId" INTEGER, msats BIGINT)
            LOOP
                IF "referral_act"."referrerId" <> item_act."targetUserId" AND "referral_act".msats > 0 THEN
                    remaining_fee_msats := remaining_fee_msats - referral_act."msats";
                    INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                        VALUES (item_act."created_at", item_act."created_at", referral_act."referrerId", payin_id, referral_act."msats", 'SATS', 'DEFUNCT_REFERRAL_ACT');
                END IF;
            END LOOP;
            FOR forward IN SELECT * FROM json_to_recordset(item_act.forwards) AS x("userId" INTEGER, pct BIGINT)
            LOOP
                IF (forward."pct" * item_act."tipMsats" / 100) > 0 THEN
                    remaining_tip_msats := remaining_tip_msats - forward."pct" * item_act."tipMsats" / 100;
                    INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                        VALUES (item_act."created_at", item_act."created_at", forward."userId", payin_id, forward."pct" * item_act."tipMsats" / 100, get_custodial_token_type(item_act."created_at"), 'ZAP');
                END IF;
            END LOOP;

            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                VALUES (item_act."created_at", item_act."created_at", item_act."targetUserId", payin_id, remaining_tip_msats, get_custodial_token_type(item_act."created_at"), 'ZAP');

            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                VALUES (item_act."created_at", item_act."created_at", 9513, payin_id, remaining_fee_msats, 'SATS', 'REWARDS_POOL');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_item_act_zaps();
DROP FUNCTION migrate_item_act_zaps();

--------------------------------------------------
-------Item Act: BOOST, DONT_LIKE_THIS, POLL -----
--------------------------------------------------

CREATE OR REPLACE FUNCTION migrate_item_act_boost_dont_like_this_poll()
RETURNS VOID AS $$
DECLARE
    item_act RECORD;
    payin_id INTEGER;
    referral_act RECORD;
    remaining_msats BIGINT := 0;
BEGIN
    FOR item_act IN
        SELECT "ItemAct".*, json_agg(json_build_object('referrerId', "ReferralAct"."referrerId", 'msats', "ReferralAct"."msats")) AS "referral_acts",
            to_jsonb("Invoice".*) AS "invoice"
        FROM "ItemAct"
        LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct"."id"
        LEFT JOIN "Invoice" ON "Invoice"."id" = "ItemAct"."invoiceId"
        WHERE "ItemAct"."act" IN ('BOOST', 'DONT_LIKE_THIS', 'POLL')
        GROUP BY "ItemAct".id, "ItemAct"."itemId", "ItemAct"."userId", "ItemAct"."created_at", "ItemAct"."msats", "ItemAct"."act", "Invoice"."id"
    LOOP
        INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
        SELECT item_act."created_at", COALESCE((item_act.invoice->>'confirmedAt')::timestamp, (item_act.invoice->>'updated_at')::timestamp, item_act."created_at"), item_act."msats",
            CASE WHEN item_act."act" = 'BOOST' THEN 'BOOST'::"PayInType" WHEN item_act."act" = 'DONT_LIKE_THIS' THEN 'DOWN_ZAP'::"PayInType" WHEN item_act."act" = 'POLL' THEN 'POLL_VOTE'::"PayInType" END,
            CASE WHEN item_act.invoice->>'confirmedAt' IS NOT NULL THEN 'PAID'::"PayInState" ELSE 'FAILED'::"PayInState" END,
            COALESCE((item_act.invoice->>'confirmedAt')::timestamp, (item_act.invoice->>'updated_at')::timestamp, item_act."created_at"), item_act."userId"
        RETURNING id INTO payin_id;

        INSERT INTO "ItemPayIn" ("payInId", "itemId") VALUES (payin_id, item_act."itemId");

        IF item_act.invoice IS NOT NULL THEN
            INSERT INTO "PayInBolt11" (created_at, updated_at, "payInId", "hash", "preimage",
                "bolt11", "expiresAt", "confirmedAt", "confirmedIndex", "cancelledAt",
                "msatsRequested", "msatsReceived", "userId", "expiryHeight", "acceptHeight")
            VALUES (item_act.invoice->>'created_at', item_act.invoice->>'updated_at', payin_id, item_act.invoice->>'hash', item_act.invoice->>'preimage',
                item_act.invoice->>'bolt11', item_act.invoice->>'expiresAt', item_act.invoice->>'confirmedAt', item_act.invoice->>'confirmedIndex', item_act.invoice->>'cancelledAt',
                item_act.invoice->>'msatsRequested', item_act.invoice->>'msatsReceived', item_act.invoice->>'userId', item_act.invoice->>'expiryHeight', item_act.invoice->>'acceptHeight');
        ELSE
            INSERT INTO "PayInCustodialToken" ("payInId", mtokens, "custodialTokenType") VALUES (payin_id, item_act."msats", get_custodial_token_type(item_act."created_at"));
        END IF;

        remaining_msats := item_act."msats";
        IF item_act.referral_acts IS NOT NULL THEN
            FOR referral_act IN SELECT * FROM json_to_recordset(item_act.referral_acts) AS x("referrerId" INTEGER, msats BIGINT)
            LOOP
                IF "referral_act".msats > 0 THEN
                    remaining_msats := remaining_msats - referral_act."msats";
                    INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                        VALUES (item_act."created_at", item_act."created_at", referral_act."referrerId", payin_id, referral_act."msats", 'SATS', 'DEFUNCT_REFERRAL_ACT');
                END IF;
            END LOOP;
        END IF;

        IF remaining_msats > 0 THEN
            INSERT INTO "PayOutCustodialToken" (created_at, updated_at, "userId", "payInId", mtokens, "custodialTokenType", "payOutType")
                VALUES (item_act."created_at", item_act."created_at", 9513, payin_id, remaining_msats, 'SATS', 'REWARDS_POOL');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_item_act_boost_dont_like_this_poll();
DROP FUNCTION migrate_item_act_boost_dont_like_this_poll();