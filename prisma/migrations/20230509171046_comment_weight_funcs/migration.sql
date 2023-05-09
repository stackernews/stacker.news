UPDATE "Item"
SET "weightedComments" = sub."weightedComments"
FROM (
    SELECT subsub."itemId", SUM(subsub."userTrust") AS "weightedComments"
    FROM
    (SELECT p.id AS "itemId", u.id AS "userId", u.trust AS "userTrust"
        FROM "Item" p
        -- all decendants of p that aren't from the same author
        JOIN "Item" c ON c.path <@ p.path AND c.id <> p.id AND c."userId" <> p."userId"
        JOIN users u ON u.id = c."userId"
        WHERE u.trust > 0
        GROUP BY p.id, u.id, u.trust) subsub
    GROUP BY subsub."itemId") sub
WHERE "Item".id = sub."itemId";

-- TODO: this could be better, e.g. testing for comment length or using comment votes instead
-- of just comment presence ... this is just an mvp
CREATE OR REPLACE FUNCTION ncomments_after_comment() RETURNS TRIGGER AS $$
DECLARE
    user_trust DOUBLE PRECISION;
BEGIN
    -- grab user's trust who is commenting
    SELECT trust INTO user_trust FROM users WHERE id = NEW."userId";

    UPDATE "Item"
    SET "lastCommentAt" = now_utc(), "ncomments" = "ncomments" + 1
    WHERE id <> NEW.id and path @> NEW.path;

    -- we only want to add the user's trust to weightedComments if they aren't
    -- already the author of a descendant comment
    UPDATE "Item"
    SET "weightedComments" = "weightedComments" + user_trust
    FROM (
        -- for every ancestor of the new comment, return the ones that don't have
        -- the same author in their descendants
        SELECT p.id
        FROM "Item" p
        -- all decendants of p that aren't the new comment
        JOIN "Item" c ON c.path <@ p.path AND c.id <> NEW.id
        -- p is an ancestor of this comment, it isn't itself, and it doesn't have the same author
        WHERE p.path @> NEW.path AND p.id <> NEW.id AND p."userId" <> NEW."userId"
        GROUP BY p.id
        -- only return p if it doesn't have any descendants with the same author as the comment
        HAVING bool_and(c."userId" <> NEW."userId")
    ) fresh
    WHERE "Item".id = fresh.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;