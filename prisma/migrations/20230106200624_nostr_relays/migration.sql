-- CreateTable
CREATE TABLE "NostrRelay" (
    "addr" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("addr")
);

-- CreateTable
CREATE TABLE "UserNostrRelay" (
    "userId" INTEGER NOT NULL,
    "nostrRelayAddr" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId","nostrRelayAddr")
);

-- AddForeignKey
ALTER TABLE "UserNostrRelay" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNostrRelay" ADD FOREIGN KEY ("nostrRelayAddr") REFERENCES "NostrRelay"("addr") ON DELETE CASCADE ON UPDATE CASCADE;
