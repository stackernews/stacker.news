-- Migrate LIFPAY users with lightning address to Custom Lightning Address (LN_ADDR)
WITH lifpay_with_addr AS (
  SELECT DISTINCT w.id
  FROM "Wallet" w
  JOIN "WalletProtocol" p
    ON p."walletId" = w.id
   AND p."send" = false
   AND p."name" = 'LN_ADDR'
  JOIN "WalletRecvLightningAddress" la
    ON la."protocolId" = p.id
  WHERE w."templateName" = 'LIFPAY'
    AND la."address" IS NOT NULL
    AND btrim(la."address") <> ''
)
UPDATE "Wallet" w
   SET "templateName" = 'LN_ADDR'
  FROM lifpay_with_addr l
 WHERE w.id = l.id;
DELETE FROM "Wallet" w
 WHERE w."templateName" = 'LIFPAY';
DELETE FROM "WalletTemplate" WHERE "name" = 'LIFPAY';