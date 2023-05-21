DROP MATERIALIZED VIEW IF EXISTS user_stats_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats_days AS
SELECT "userId" as id, day,
    sum(msats_spent) as msats_spent,
    sum(comments) as comments,
    sum(posts) as posts,
    sum(referrals) as referrals,
    sum(msats_stacked) as msats_stacked
FROM
   ((SELECT "userId", sum(msats) as msats_spent, 0 as comments, 0 as posts, 0 as referrals,
     0 as msats_stacked, date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC')) as day
    FROM "ItemAct"
    GROUP BY "userId", day)
    UNION ALL
  (SELECT "userId", sum(sats*1000) as msats_spent, 0 as comments, 0 as posts, 0 as referrals,
     0 as msats_stacked, date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC')) as day
    FROM "Donation"
    GROUP BY "userId", day)
    UNION ALL
   (SELECT "userId", 0 as msats_spent, count("parentId") as comments, count(*)-count("parentId") as posts,
        0 as referrals, 0 as msats_stacked,
    date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC')) as day
    FROM "Item"
    GROUP BY "userId", day)
    UNION ALL
   (SELECT "referrerId" as "userId", 0 as msats_spent, 0 as comments, 0 as posts, count(*) as referrals,
    0 as msats_stacked, date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC')) as day
    FROM users
    WHERE "referrerId" IS NOT NULL
    GROUP BY "userId", day)
    UNION ALL
   (SELECT "Item"."userId", 0 as msats_spent, 0 as comments, 0 as posts, 0 as referrals,
     sum("ItemAct".msats) as msats_stacked,
     date_trunc('day', timezone('America/Chicago', "ItemAct".created_at at time zone 'UTC')) as day
     FROM "ItemAct"
     JOIN "Item" on "ItemAct"."itemId" = "Item".id
     WHERE "ItemAct".act = 'TIP'
     GROUP BY "Item"."userId", day)
    UNION ALL
   (SELECT "userId", 0 as msats_spent, 0 as comments, 0 as posts, 0 as referrals,
     sum(msats) as msats_stacked,
     date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC')) as day
     FROM "Earn"
     GROUP BY "userId", day)
    UNION ALL
   (SELECT "referrerId" as "userId", 0 as msats_spent, 0 as comments, 0 as posts, 0 as referrals,
     sum(msats) as msats_stacked,
     date_trunc('day', timezone('America/Chicago', created_at at time zone 'UTC')) as day
     FROM "ReferralAct"
     GROUP BY "userId", day)) u
GROUP BY "userId", day;