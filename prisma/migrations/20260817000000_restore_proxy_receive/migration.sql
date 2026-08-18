ALTER TABLE "users"
ADD COLUMN "proxyReceive" BOOLEAN NOT NULL DEFAULT true;

-- Preserve the privacy-first behavior existing users had before this setting
-- was removed without updating user rows and firing their update triggers.
-- Accounts created after this migration use the new false default.
ALTER TABLE "users"
ALTER COLUMN "proxyReceive" SET DEFAULT false;

ALTER TABLE "PayInBolt11NostrNote"
ADD COLUMN "rawRequest" TEXT;

CREATE TABLE "ExternalTransactionLud18" (
    "id" SERIAL NOT NULL,
    "externalTransactionId" INTEGER NOT NULL,
    "name" TEXT,
    "identifier" TEXT,
    "email" TEXT,
    "pubkey" TEXT,

    CONSTRAINT "ExternalTransactionLud18_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalTransactionNostrNote" (
    "id" SERIAL NOT NULL,
    "externalTransactionId" INTEGER NOT NULL,
    "note" JSONB NOT NULL,
    "rawRequest" TEXT NOT NULL,

    CONSTRAINT "ExternalTransactionNostrNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalTransactionComment" (
    "id" SERIAL NOT NULL,
    "externalTransactionId" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "ExternalTransactionComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalTransactionLud18_externalTransactionId_key"
ON "ExternalTransactionLud18"("externalTransactionId");

CREATE UNIQUE INDEX "ExternalTransactionNostrNote_externalTransactionId_key"
ON "ExternalTransactionNostrNote"("externalTransactionId");

CREATE UNIQUE INDEX "ExternalTransactionComment_externalTransactionId_key"
ON "ExternalTransactionComment"("externalTransactionId");

ALTER TABLE "ExternalTransactionLud18"
ADD CONSTRAINT "ExternalTransactionLud18_externalTransactionId_fkey"
FOREIGN KEY ("externalTransactionId") REFERENCES "ExternalTransaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalTransactionNostrNote"
ADD CONSTRAINT "ExternalTransactionNostrNote_externalTransactionId_fkey"
FOREIGN KEY ("externalTransactionId") REFERENCES "ExternalTransaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalTransactionComment"
ADD CONSTRAINT "ExternalTransactionComment_externalTransactionId_fkey"
FOREIGN KEY ("externalTransactionId") REFERENCES "ExternalTransaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
