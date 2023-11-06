-- CreateEnum
CREATE TYPE "NonItemActType" AS ENUM ('NYM_CHANGE');

-- CreateTable
CREATE TABLE "NonItemAct" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "msats" BIGINT NOT NULL,
    "type" "NonItemActType" NOT NULL,

    CONSTRAINT "NonItemAct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NonItemAct.userId_index" ON "NonItemAct"("userId");

-- CreateIndex
CREATE INDEX "NonItemAct.userId_type_index" ON "NonItemAct"("userId", "type");

-- CreateIndex
CREATE INDEX "NonItemAct.type_index" ON "NonItemAct"("type");

-- CreateIndex
CREATE INDEX "NonItemAct.created_at_index" ON "NonItemAct"("created_at");

-- CreateIndex
CREATE INDEX "NonItemAct.created_at_type_index" ON "NonItemAct"("created_at", "type");

-- CreateIndex
CREATE INDEX "NonItemAct.userId_created_at_type_index" ON "NonItemAct"("userId", "created_at", "type");

-- AddForeignKey
ALTER TABLE "NonItemAct" ADD CONSTRAINT "NonItemAct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- This is required to use the `levenshtein` builtin functions
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

CREATE OR REPLACE FUNCTION edit_nym(user_id INTEGER, new_nym TEXT, cost_sats BIGINT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    cost_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats INTO user_msats FROM users WHERE id = user_id;

    cost_msats := 1000 * cost_sats;

    IF cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - cost_msats, name = new_nym WHERE id = user_id;

    IF cost_msats > 0 THEN
        INSERT INTO "NonItemAct" ("userId", msats, type)
            VALUES (user_id, cost_msats, 'NYM_CHANGE');
    END IF;
END;
$$;
