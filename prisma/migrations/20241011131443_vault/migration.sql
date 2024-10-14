-- AlterTable
ALTER TABLE "users" ADD COLUMN     "vaultKeyHash" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Vault" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" INTEGER NOT NULL,
    "ownerType" TEXT NOT NULL,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vault.userId_index" ON "Vault"("userId");

-- CreateIndex
CREATE INDEX "Vault.ownerId_ownerType_index" ON "Vault"("ownerId", "ownerType");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_userId_key_ownerId_ownerType_key" ON "Vault"("userId", "key", "ownerId", "ownerType");

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
