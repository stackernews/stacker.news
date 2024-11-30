-- AlterTable
ALTER TABLE "WalletBlink" ALTER COLUMN "apiKeyRecv" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WalletLNbits" ALTER COLUMN "invoiceKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WalletNWC" ALTER COLUMN "nwcUrlRecv" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WalletPhoenixd" ALTER COLUMN "secondaryPassword" DROP NOT NULL;
