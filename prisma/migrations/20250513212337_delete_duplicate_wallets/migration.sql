-- delete duplicate wallets per user
WITH duplicates AS (
    SELECT
        "userId",
        "type",
        (array_agg(id ORDER BY updated_at DESC))[2:] AS id
    FROM "Wallet"
    GROUP BY "userId", "type"
    HAVING COUNT(id) > 1
    ORDER BY COUNT(id) DESC, "userId" ASC
)
DELETE FROM "Wallet"
WHERE id in (SELECT unnest(id) FROM duplicates);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_type_key" ON "Wallet"("userId", "type");
