-- AlterTable
ALTER TABLE "Invite" ALTER COLUMN "id" SET DEFAULT encode(gen_random_bytes(12), 'hex'::text);
