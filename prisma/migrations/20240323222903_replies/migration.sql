-- CreateTable
CREATE TABLE "Reply" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ancestorId" INTEGER NOT NULL,
    "ancestorUserId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reply_ancestorId_idx" ON "Reply"("ancestorId");

-- CreateIndex
CREATE INDEX "Reply_ancestorUserId_idx" ON "Reply"("ancestorUserId");

-- CreateIndex
CREATE INDEX "Reply_level_idx" ON "Reply"("level");

-- CreateIndex
CREATE INDEX "Reply_created_at_idx" ON "Reply"("created_at");

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_ancestorUserId_fkey" FOREIGN KEY ("ancestorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION ncomments_after_comment() RETURNS TRIGGER AS $$
DECLARE
    user_trust DOUBLE PRECISION;
BEGIN
    -- grab user's trust who is commenting
    SELECT trust INTO user_trust FROM users WHERE id = NEW."userId";

    UPDATE "Item"
    SET "lastCommentAt" = now_utc(), "ncomments" = "ncomments" + 1
    WHERE id <> NEW.id and path @> NEW.path;

    -- we only want to add the user's trust to weightedComments if they aren't
    -- already the author of a descendant comment
    UPDATE "Item"
    SET "weightedComments" = "weightedComments" + user_trust
    FROM (
        -- for every ancestor of the new comment, return the ones that don't have
        -- the same author in their descendants
        SELECT p.id
        FROM "Item" p
        -- all decendants of p that aren't the new comment
        JOIN "Item" c ON c.path <@ p.path AND c.id <> NEW.id
        -- p is an ancestor of this comment, it isn't itself, and it doesn't have the same author
        WHERE p.path @> NEW.path AND p.id <> NEW.id AND p."userId" <> NEW."userId"
        GROUP BY p.id
        -- only return p if it doesn't have any descendants with the same author as the comment
        HAVING bool_and(c."userId" <> NEW."userId")
    ) fresh
    WHERE "Item".id = fresh.id;

    -- insert the comment into the reply table for every ancestor
    INSERT INTO "Reply" (created_at, updated_at, "ancestorId", "ancestorUserId", "itemId", "userId", level)
    SELECT NEW.created_at, NEW.updated_at, p.id, p."userId", NEW.id, NEW."userId", nlevel(NEW.path) - nlevel(p.path)
    FROM "Item" p
    WHERE p.path @> NEW.path AND p.id <> NEW.id AND p."userId" <> NEW."userId";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- insert the comment into the reply table for every ancestor retroactively
INSERT INTO "Reply" (created_at, updated_at, "ancestorId", "ancestorUserId", "itemId", "userId", level)
SELECT c.created_at, c.created_at, p.id, p."userId", c.id, c."userId", nlevel(c.path) - nlevel(p.path)
FROM "Item" p
JOIN "Item" c ON c.path <@ p.path AND c.id <> p.id AND p."userId" <> c."userId";