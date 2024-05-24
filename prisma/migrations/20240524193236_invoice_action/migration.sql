-- create function so we can run handle_action inside the same tx as confirm_invoice
CREATE OR REPLACE FUNCTION invoice_action(actionType "ActionType", actionId INTEGER, actionData JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    cost_msats BIGINT;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    cost_msats := (actionData->>'cost')::BIGINT;

    IF actionType = 'ITEM' THEN
        UPDATE "Item" SET status = 'ACTIVE' WHERE id = actionId RETURNING * INTO item;

        UPDATE users SET msats = msats - cost_msats WHERE id = item."userId";

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act)
        VALUES (cost_msats, item.id, item."userId", 'FEE');

        IF item.boost > 0 THEN
            PERFORM item_act(item.id, item."userId", 'BOOST', item.boost);
        END IF;

        IF item."maxBid" IS NOT NULL THEN
            PERFORM run_auction(item.id);
        END IF;

        RETURN 0;
    END IF;

    RETURN 1;
END;
$$;

-- run invoice_action on confirmation
CREATE OR REPLACE FUNCTION confirm_invoice(lnd_id TEXT, lnd_received BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_id INTEGER;
    confirmed_at TIMESTAMP;
    actionType "ActionType";
    actionId INTEGER;
    actionData JSONB;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT "userId", "confirmedAt", "actionType", "actionId", "actionData"
    INTO user_id, confirmed_at, actionType, actionId, actionData
    FROM "Invoice" WHERE hash = lnd_id;

    IF confirmed_at IS NULL THEN
        UPDATE "Invoice"
        SET "msatsReceived" = lnd_received, "confirmedAt" = now_utc(), updated_at = now_utc()
        WHERE hash = lnd_id;

        UPDATE users SET msats = msats + lnd_received WHERE id = user_id;

        IF actionType IS NOT NULL AND actionId IS NOT NULL THEN
            PERFORM invoice_action(actionType, actionId, actionData);
        END IF;

        RETURN 0;
    END IF;

    RETURN 1;
END;
$$;
