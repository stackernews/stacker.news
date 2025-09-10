WITH deleted_protocols AS (
    DELETE FROM "WalletProtocol"
    WHERE id IN (
        SELECT "protocolId" FROM "WalletRecvNWC"
        WHERE id IN (
            7,
            67,
            140,
            157,
            158,
            166
        )
    )
    RETURNING "walletId"
)
DELETE FROM "Wallet"
WHERE id IN (SELECT "walletId" FROM deleted_protocols)
AND NOT EXISTS (SELECT 1 FROM "WalletProtocol" WHERE "walletId" = "Wallet"."id");
