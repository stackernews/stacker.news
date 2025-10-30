/*
  Warnings:

  - The values [LIFPAY] on the enum `WalletName` will be removed. If these variants are still used in the database, this will fail.

*/

-- Data migration: move LIFPAY users to Custom Lightning Address (LN_ADDR)
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
ALTER TABLE "Wallet" DROP CONSTRAINT IF EXISTS "Wallet_templateName_fkey";
BEGIN;
CREATE TYPE "WalletName_new" AS ENUM ('ALBY', 'BLINK', 'BLIXT', 'CASHU_ME', 'CLN', 'COINOS', 'FOUNTAIN', 'LNBITS', 'LND', 'MINIBITS', 'NPUB_CASH', 'PHOENIXD', 'PRIMAL', 'RIZFUL', 'SHOCKWALLET', 'SPEED', 'STRIKE', 'VOLTAGE', 'WALLET_OF_SATOSHI', 'ZBD', 'ZEUS', 'NWC', 'LN_ADDR', 'CASH_APP', 'BLITZ');
ALTER TABLE "WalletTemplate" ALTER COLUMN "name" TYPE "WalletName_new" USING ("name"::text::"WalletName_new");
ALTER TABLE "Wallet" ALTER COLUMN "templateName" TYPE "WalletName_new" USING ("templateName"::text::"WalletName_new");
ALTER TYPE "WalletName" RENAME TO "WalletName_old";
ALTER TYPE "WalletName_new" RENAME TO "WalletName";
DROP TYPE "WalletName_old";
COMMIT;
ALTER TABLE "Wallet"
  ADD CONSTRAINT "Wallet_templateName_fkey"
  FOREIGN KEY ("templateName")
  REFERENCES "WalletTemplate"("name")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
