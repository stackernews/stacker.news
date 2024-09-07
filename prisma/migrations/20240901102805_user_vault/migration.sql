ALTER TABLE "users" ADD COLUMN "vaultKeyHash" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "UserVault" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    UNIQUE ("userId", "key")
);

-- CreateIndex
CREATE INDEX "UserVault.userId_index" ON "UserVault"("userId");

-- AddForeignKey
ALTER TABLE "UserVault" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mitigate spamming the UserVault table by limiting the number of entries per user to 100
CREATE OR REPLACE FUNCTION enforce_user_vault_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM "UserVault" WHERE "userId" = NEW."userId") >= 100 THEN
        RAISE EXCEPTION 'User cannot have more than 100 vault entries';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_user_vault_limit_trigger
BEFORE INSERT ON "UserVault"
FOR EACH ROW
EXECUTE FUNCTION enforce_user_vault_limit();

