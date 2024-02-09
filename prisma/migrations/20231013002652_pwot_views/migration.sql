CREATE OR REPLACE VIEW zap_rank_personal_constants AS
SELECT
5000.0 AS boost_per_vote,
1.2 AS vote_power,
1.3 AS vote_decay,
3.0 AS age_wait_hours,
0.5 AS comment_scaler,
1.2 AS boost_power,
1.6 AS boost_decay,
616 AS global_viewer_id,
interval '7 days' AS item_age_bound,
interval '7 days' AS user_last_seen_bound,
0.9 AS max_personal_viewer_vote_ratio,
0.1 AS min_viewer_votes;

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
        "ItemAct"."userId" <> "Item"."userId" AND "ItemAct".act IN ('TIP', 'FEE', 'DONT_LIKE_THIS')
        OR "ItemAct".act = 'BOOST' AND "ItemAct"."userId" = "Item"."userId"
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

CREATE UNIQUE INDEX IF NOT EXISTS zap_rank_personal_view_viewer_id_idx ON zap_rank_personal_view("viewerId", id);
CREATE INDEX IF NOT EXISTS hot_tf_zap_rank_personal_view_idx ON zap_rank_personal_view("viewerId", tf_hot_score DESC NULLS LAST, id DESC);
CREATE INDEX IF NOT EXISTS top_tf_zap_rank_personal_view_idx ON zap_rank_personal_view("viewerId", tf_top_score DESC NULLS LAST, id DESC);

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
        || '    to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
        || '    COALESCE("ItemAct"."meMsats", 0) AS "meMsats", COALESCE("ItemAct"."meDontLike", false) AS "meDontLike", '
        || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
        || '    GREATEST(g.tf_hot_score, l.tf_hot_score) AS personal_hot_score, GREATEST(g.tf_top_score, l.tf_top_score) AS personal_top_score '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    LEFT JOIN "Mute" ON "Mute"."muterId" = $5 AND "Mute"."mutedId" = "Item"."userId"'
        || '    LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $5 AND "Bookmark"."itemId" = "Item".id '
        || '    LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $5 AND "ThreadSubscription"."itemId" = "Item".id '
        || '    LEFT JOIN LATERAL ( '
        || '        SELECT "itemId", sum("ItemAct".msats) FILTER (WHERE act = ''FEE'' OR act = ''TIP'') AS "meMsats", '
        || '            bool_or(act = ''DONT_LIKE_THIS'') AS "meDontLike" '
        || '        FROM "ItemAct" '
        || '        WHERE "ItemAct"."userId" = $5 '
        || '        AND "ItemAct"."itemId" = "Item".id '
        || '        GROUP BY "ItemAct"."itemId" '
        || '    ) "ItemAct" ON true '
        || '    LEFT JOIN zap_rank_personal_view g ON g."viewerId" = $6 AND g.id = "Item".id '
        || '    LEFT JOIN zap_rank_personal_view l ON l."viewerId" = $5 AND l.id = g.id '
        || '    WHERE  "Item".path <@ $1::TEXT::LTREE ' || _where || ' '
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
        || '    to_jsonb(users.*) as user '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    WHERE  "Item".path <@ $1::TEXT::LTREE ' || _where
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

CREATE OR REPLACE FUNCTION update_ranked_views_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name) values ('trust');
    UPDATE pgboss.schedule SET cron = '*/5 * * * *' WHERE name = 'rankViews';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT update_ranked_views_jobs();

