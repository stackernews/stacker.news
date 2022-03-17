-- CreateTable
CREATE TABLE "Earn" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "msats" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Earn.created_at_index" ON "Earn"("created_at");

-- CreateIndex
CREATE INDEX "Earn.userId_index" ON "Earn"("userId");

-- AddForeignKey
ALTER TABLE "Earn" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- charge the user for the auction item
CREATE OR REPLACE FUNCTION earn(user_id INTEGER, earn_msats INTEGER) RETURNS void AS $$
    DECLARE
    BEGIN
        PERFORM ASSERT_SERIALIZED();
        -- insert into earn
        INSERT INTO "Earn" (msats, "userId") VALUES (earn_msats, user_id);
        -- give the user the sats
        UPDATE users SET msats = msats + earn_msats WHERE id = user_id;
    END;
$$ LANGUAGE plpgsql;