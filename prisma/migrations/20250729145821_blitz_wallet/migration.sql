-- Without the commit, the migration fails when we try to insert the new row:
--
-- Error: P3006
--
-- Migration `20250729145821_blitz_wallet` failed to apply cleanly to the shadow database.
-- Error:
-- ERROR: unsafe use of new value "BLITZ" of enum type "WalletName"
-- HINT: New enum values must be committed before they can be used.
ALTER TYPE "WalletName" ADD VALUE 'BLITZ'; COMMIT;

INSERT INTO "WalletTemplate" (name, "sendProtocols", "recvProtocols")
VALUES (
    'BLITZ',
    ARRAY[]::"WalletSendProtocolName"[],
    ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]
);
