-- Backfill separately from the lock-taking schema changes so Item remains
-- available to normal reads and writes while the historical data is updated.
WITH paid_items AS (
    SELECT ip."itemId", min(p."payInStateChangedAt") AS "paidAt"
    FROM "ItemPayIn" ip
    JOIN "PayIn" p ON p.id = ip."payInId"
    WHERE p."payInType" = 'ITEM_CREATE'
      AND p."payInState" = 'PAID'
    GROUP BY ip."itemId"
)
UPDATE "Item" i
SET "paidAt" = paid_items."paidAt"
FROM paid_items
WHERE i.id = paid_items."itemId"
  AND i."paidAt" IS DISTINCT FROM paid_items."paidAt";
