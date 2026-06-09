-- delete protocols that have accidentally been saved in plaintext with permissions to spend
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
);

-- delete wallets that now have no protocols
DELETE FROM "Wallet"
WHERE NOT EXISTS (SELECT 1 FROM "WalletProtocol" WHERE "walletId" = "Wallet"."id");

-- badges will not be updated but that's okay, not important enough for the effort
