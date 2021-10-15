CREATE OR REPLACE FUNCTION invite_drain(user_id INTEGER, invite_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    inviter_id   INTEGER;
    inviter_sats INTEGER;
    gift         INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();
    -- check user was created in last hour
    -- check user did not already redeem an invite
    PERFORM FROM users
    WHERE id = user_id AND users.created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 HOUR'
    AND users."inviteId" IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SN_INELIGIBLE';
    END IF;

    -- check that invite has not reached limit
    -- check that invite is not revoked
    SELECT "Invite"."userId", "Invite".gift INTO inviter_id, gift FROM "Invite"
    LEFT JOIN users ON users."inviteId" = invite_id
    WHERE "Invite".id = invite_id AND NOT "Invite".revoked
    GROUP BY "Invite".id
    HAVING COUNT(DISTINCT users.id) < "Invite".limit OR "Invite".limit IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SN_REVOKED_OR_EXHAUSTED';
    END IF;

    -- check that inviter has sufficient balance
    SELECT (msats / 1000) INTO inviter_sats
    FROM users WHERE id = inviter_id;
    IF inviter_sats < gift THEN
        RAISE EXCEPTION 'SN_REVOKED_OR_EXHAUSTED';
    END IF;

    -- subtract amount from inviter
    UPDATE users SET msats = msats - (1000 * gift) WHERE id = inviter_id;
    -- add amount to invitee
    UPDATE users SET msats = msats + (1000 * gift), "inviteId" = invite_id WHERE id = user_id;

    RETURN 0;
END;
$$;