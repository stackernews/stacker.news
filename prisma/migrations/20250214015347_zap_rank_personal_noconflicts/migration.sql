DROP MATERIALIZED VIEW IF EXISTS zap_rank_personal_view;
CREATE MATERIALIZED VIEW IF NOT EXISTS zap_rank_personal_view AS
WITH item_votes AS (
    SELECT "Item".id, "Item"."parentId", "Item".boost, "Item".created_at, "Item"."weightedComments", "ItemAct"."userId" AS "voterId",
        LOG((SUM("ItemAct".msats) FILTER (WHERE "ItemAct".act IN ('TIP', 'FEE'))) / 1000.0) AS "vote",
        GREATEST(LOG((SUM("ItemAct".msats) FILTER (WHERE "ItemAct".act = 'DONT_LIKE_THIS')) / 1000.0), 0) AS "downVote"
    FROM "Item"
    CROSS JOIN zap_rank_personal_constants
    JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
    WHERE (
        ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        AND
        (
            ("ItemAct"."userId" <> "Item"."userId" AND "ItemAct".act IN ('TIP', 'FEE', 'DONT_LIKE_THIS'))
        OR
            ("ItemAct".act = 'BOOST' AND "ItemAct"."userId" = "Item"."userId")
        )
    )
    AND "Item".created_at >= now_utc() - item_age_bound
    GROUP BY "Item".id, "Item"."parentId", "Item".boost, "Item".created_at, "Item"."weightedComments", "ItemAct"."userId"
    HAVING SUM("ItemAct".msats) > 1000
), viewer_votes AS (
    SELECT item_votes.id, item_votes."parentId", item_votes.boost, item_votes.created_at,
        item_votes."weightedComments", "Arc"."fromId" AS "viewerId",
        GREATEST("Arc"."zapTrust", g."zapTrust", 0) * item_votes."vote" AS "weightedVote",
        GREATEST("Arc"."zapTrust", g."zapTrust", 0) * item_votes."downVote" AS "weightedDownVote"
    FROM item_votes
    CROSS JOIN zap_rank_personal_constants
    LEFT JOIN "Arc" ON "Arc"."toId" = item_votes."voterId"
    LEFT JOIN "Arc" g ON g."fromId" = global_viewer_id AND g."toId" = item_votes."voterId"
    AND ("Arc"."zapTrust" IS NOT NULL OR g."zapTrust" IS NOT NULL)
), viewer_weighted_votes AS (
    SELECT viewer_votes.id, viewer_votes."parentId", viewer_votes.boost, viewer_votes.created_at, viewer_votes."viewerId",
        viewer_votes."weightedComments", SUM(viewer_votes."weightedVote") AS "weightedVotes",
        SUM(viewer_votes."weightedDownVote") AS "weightedDownVotes"
    FROM viewer_votes
    GROUP BY viewer_votes.id, viewer_votes."parentId", viewer_votes.boost, viewer_votes.created_at, viewer_votes."viewerId", viewer_votes."weightedComments"
), viewer_zaprank AS (
    SELECT l.id, l."parentId", l.boost, l.created_at, l."viewerId", l."weightedComments",
        GREATEST(l."weightedVotes", g."weightedVotes") AS "weightedVotes", GREATEST(l."weightedDownVotes", g."weightedDownVotes") AS "weightedDownVotes"
    FROM viewer_weighted_votes l
    CROSS JOIN zap_rank_personal_constants
    JOIN users ON users.id = l."viewerId"
    JOIN viewer_weighted_votes g ON l.id = g.id AND g."viewerId" = global_viewer_id
    WHERE (l."weightedVotes" > min_viewer_votes
        AND g."weightedVotes" / l."weightedVotes" <= max_personal_viewer_vote_ratio
        AND users."lastSeenAt" >= now_utc() - user_last_seen_bound)
    OR l."viewerId" = global_viewer_id
    GROUP BY l.id, l."parentId", l.boost, l.created_at, l."viewerId", l."weightedVotes", l."weightedComments",
        g."weightedVotes", l."weightedDownVotes", g."weightedDownVotes", min_viewer_votes
    HAVING GREATEST(l."weightedVotes", g."weightedVotes") > min_viewer_votes OR l.boost > 0
), viewer_fractions_zaprank AS (
    SELECT z.*,
        (CASE WHEN z."weightedVotes" - z."weightedDownVotes" > 0 THEN
              GREATEST(z."weightedVotes" - z."weightedDownVotes", POWER(z."weightedVotes" - z."weightedDownVotes", vote_power))
            ELSE
                z."weightedVotes" - z."weightedDownVotes"
            END + z."weightedComments" * CASE WHEN z."parentId" IS NULL THEN comment_scaler ELSE 0 END) AS tf_numerator,
        POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - z.created_at))/3600), vote_decay) AS decay_denominator,
        (POWER(z.boost/boost_per_vote, boost_power)
         /
         POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - z.created_at))/3600), boost_decay)) AS boost_addend
    FROM viewer_zaprank z, zap_rank_personal_constants
)
SELECT z.id, z."parentId", z."viewerId",
    COALESCE(tf_numerator, 0) / decay_denominator + boost_addend AS tf_hot_score,
    COALESCE(tf_numerator, 0) AS tf_top_score
FROM viewer_fractions_zaprank z
WHERE tf_numerator > 0 OR boost_addend > 0;