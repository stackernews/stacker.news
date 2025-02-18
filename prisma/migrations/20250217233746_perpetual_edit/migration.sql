-- We store into OldItem the history of the item that gets edited by the user

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "cloneBornAt" TIMESTAMP(3),
ADD COLUMN     "cloneDiedAt" TIMESTAMP(3);

-- CreateTable
-- TODO Postgres supports Inheritance but Prisma doesn't support it yet
-- Figure out a better way to do this
CREATE TABLE "OldItem" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "text" TEXT,
    "url" TEXT,
    "userId" INTEGER NOT NULL,
    "subName" CITEXT,
    "imgproxyUrls" JSONB,
    "cloneBornAt" TIMESTAMP(3),
    "cloneDiedAt" TIMESTAMP(3),
    "uploadId" INTEGER,
    "pollCost" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "original_itemId" INTEGER NOT NULL,

    CONSTRAINT "OldItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OldItem_created_at_idx" ON "OldItem"("created_at");

-- CreateIndex
CREATE INDEX "OldItem_userId_idx" ON "OldItem"("userId");

-- CreateIndex
CREATE INDEX "OldItem_original_itemId_idx" ON "OldItem"("original_itemId");

-- AddForeignKey
ALTER TABLE "OldItem" ADD CONSTRAINT "OldItem_original_itemId_fkey" FOREIGN KEY ("original_itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION before_item_update()
RETURNS TRIGGER AS $$
BEGIN
    -- history shall be written only if the item is older than 10 minutes and content has changed
    IF (OLD."created_at" < now() - interval '10 minutes')
    AND OLD."bio" IS FALSE
    AND NEW."deletedAt" IS NULL
    AND (OLD."text" != NEW."text" OR OLD."title" != NEW."title" OR OLD."url" != NEW."url")
    THEN
        -- TODO honestly find a better way to do this, I mean this works but it's bad
        INSERT INTO "OldItem" (
            "created_at",
            "updated_at",
            "title",
            "text",
            "url",
            "userId",
            "subName",
            "imgproxyUrls",
            "cloneBornAt",
            "cloneDiedAt",
            "uploadId",
            "pollCost",
            "deletedAt",
            "original_itemId"
        )
        VALUES (
            OLD."created_at",
            OLD."updated_at",
            OLD."title",
            OLD."text",
            OLD."url",
            OLD."userId",
            OLD."subName",
            OLD."imgproxyUrls",
            OLD."cloneBornAt",
            OLD."cloneDiedAt",
            OLD."uploadId",
            OLD."pollCost",
            OLD."deletedAt",
            OLD."id"
        );
        
        -- item shall die
        UPDATE "OldItem" 
        SET "cloneDiedAt" = now()
        WHERE "original_itemId" = OLD.id 
        AND "cloneDiedAt" IS NULL;

        -- to be born again
        NEW."cloneBornAt" = now();
        NEW."cloneDiedAt" = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_history_trigger
    BEFORE UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE PROCEDURE before_item_update();
