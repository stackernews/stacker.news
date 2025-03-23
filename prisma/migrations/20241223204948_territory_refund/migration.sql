-- refund users who have active territories and paid the old, higher price
-- for the rest of their billing period once the switchover is complete

WITH active_territories AS (
    SELECT *,
        "billingCost" *
            EXTRACT(epoch FROM "billPaidUntil" - now()) / EXTRACT(epoch FROM "billPaidUntil" - "billedLastAt") *
                0.5 AS refund_sats
    FROM "Sub"
    WHERE "status" = 'ACTIVE'
    AND "billingType" IN ('MONTHLY', 'YEARLY')
)
UPDATE users
SET msats = msats + refund_sats*1000
FROM active_territories
WHERE users.id = active_territories."userId";