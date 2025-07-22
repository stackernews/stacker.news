ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
INSERT INTO "users" (id, name) VALUES (106, 'delete') ON CONFLICT (id) DO NOTHING;