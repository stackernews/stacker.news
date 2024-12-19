-- fix revenue for users who have multiple revenue entries for the same day
WITH revenue_days AS (
  SELECT coalesce(sum(msats), 0) as revenue_msats, "userId", created_at
  FROM "SubAct"
  WHERE type = 'REVENUE'
  GROUP BY "userId", created_at
  HAVING COUNT(*) > 1
),
revenue_total AS (
  SELECT coalesce(sum(revenue_msats), 0) as revenue_msats, "userId"
  FROM revenue_days
  GROUP BY "userId"
)
UPDATE users SET msats = users.msats + revenue_total.revenue_msats
FROM revenue_total
WHERE users.id = revenue_total."userId";

-- fix stacked msats for users who have territory revenue
-- prior to this, we were not updating stacked msats for territory revenue
WITH territory_revenue AS (
  SELECT coalesce(sum(msats), 0) as revenue_msats, "userId"
  FROM "SubAct"
  WHERE type = 'REVENUE'
  GROUP BY "userId"
)
UPDATE users SET "stackedMsats" = users."stackedMsats" + territory_revenue.revenue_msats
FROM territory_revenue
WHERE users.id = territory_revenue."userId";
