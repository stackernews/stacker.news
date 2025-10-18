-- AlterTable - Lexical Editor support
-- lexicalState is the raw JSON state of the editor
-- html is the sanitized HTML result of the editor
ALTER TABLE "Item" ADD COLUMN "lexicalState" JSONB, ADD COLUMN "html" TEXT;
