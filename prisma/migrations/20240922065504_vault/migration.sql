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

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vault.userId_index" ON "Vault"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_userId_key_key" ON "Vault"("userId", "key");

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- avoid spam
CREATE OR REPLACE FUNCTION enforce_vault_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM "Vault" WHERE "userId" = NEW."userId") >= 100 THEN
        RAISE EXCEPTION 'vault limit of 100 entries per user reached';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_vault_limit_trigger
BEFORE INSERT ON "Vault"
FOR EACH ROW
EXECUTE FUNCTION enforce_vault_limit();
