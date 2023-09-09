-- CreateEnum
CREATE TYPE "CsvStatus" AS ENUM ('NO_REQUEST', 'IN_PROGRESS', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "requestingCsv" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "csvStatus" "CsvStatus" NOT NULL DEFAULT 'NO_REQUEST';

CREATE OR REPLACE FUNCTION csv_check() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data, singletonkey) VALUES ('csvQueue', jsonb_build_object('id', NEW.id), NEW.id)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_csv ON users;
CREATE TRIGGER user_csv
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (NEW."requestingCsv" <> OLD."requestingCsv")
    EXECUTE PROCEDURE csv_check();