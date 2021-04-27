-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);


-- Edit: create extension for path
CREATE EXTENSION ltree;

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "url" TEXT,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "path" LTREE,

    PRIMARY KEY ("id")
);

-- Edit: create index for path
CREATE INDEX "item_gist_path_index" ON "Item" USING GIST ("path");

-- Edit: create trigger for path
CREATE OR REPLACE FUNCTION update_item_path() RETURNS TRIGGER AS $$
    DECLARE
        npath ltree;
    BEGIN
        IF NEW."parentId" IS NULL THEN
            SELECT NEW.id::text::ltree INTO npath;
        ELSEIF TG_OP = 'INSERT' OR OLD."parentId" IS NULL OR OLD."parentId" != NEW."parentId" THEN
            SELECT "path" || NEW.id::text FROM "Item" WHERE id = NEW."parentId" INTO npath;
            IF npath IS NULL THEN
                RAISE EXCEPTION 'Invalid parent_id %', NEW."parentId";
            END IF;
        END IF;
        NEW."path" = npath;
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER path_tgr
    BEFORE INSERT OR UPDATE ON "Item"
    FOR EACH ROW EXECUTE PROCEDURE update_item_path();

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sats" INTEGER NOT NULL DEFAULT 1,
    "boost" BOOLEAN NOT NULL DEFAULT false,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "compound_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider_type" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "access_token_expires" TIMESTAMP(3),

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "session_token" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users.name_unique" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users.email_unique" ON "users"("email");

-- CreateIndex
CREATE INDEX "Item.userId_index" ON "Item"("userId");

-- CreateIndex
CREATE INDEX "Item.parentId_index" ON "Item"("parentId");

-- CreateIndex
CREATE INDEX "Vote.itemId_index" ON "Vote"("itemId");

-- CreateIndex
CREATE INDEX "Vote.userId_index" ON "Vote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts.compound_id_unique" ON "accounts"("compound_id");

-- CreateIndex
CREATE INDEX "accounts.provider_account_id_index" ON "accounts"("provider_account_id");

-- CreateIndex
CREATE INDEX "accounts.provider_id_index" ON "accounts"("provider_id");

-- CreateIndex
CREATE INDEX "accounts.user_id_index" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions.session_token_unique" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "sessions.access_token_unique" ON "sessions"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests.token_unique" ON "verification_requests"("token");

-- AddForeignKey
ALTER TABLE "Message" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD FOREIGN KEY ("parentId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
