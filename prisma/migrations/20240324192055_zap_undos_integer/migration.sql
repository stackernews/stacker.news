ALTER TABLE "users" ADD COLUMN "zapUndosTmp" INTEGER;
UPDATE "users" SET "zapUndosTmp" = CASE WHEN "zapUndos" = false THEN NULL ELSE 0::INTEGER END;
ALTER TABLE "users" DROP COLUMN "zapUndos";
ALTER TABLE "users" RENAME COLUMN "zapUndosTmp" TO "zapUndos";
