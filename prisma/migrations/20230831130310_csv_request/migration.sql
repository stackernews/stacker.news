-- CreateEnum
CREATE TYPE "CsvRequest" AS ENUM ('NO_REQUEST', 'FULL_REPORT');

-- CreateEnum
CREATE TYPE "CsvRequestStatus" AS ENUM ('NO_REQUEST', 'FULL_REPORT', 'GENERATING_REPORT', 'INCOMPLETE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "csvRequest" "CsvRequest" NOT NULL DEFAULT 'NO_REQUEST',
ADD COLUMN     "csvRequestStatus" "CsvRequestStatus" NOT NULL DEFAULT 'NO_REQUEST';

CREATE OR REPLACE FUNCTION csv_check() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data, singletonkey) VALUES ('csvQueue', jsonb_build_object('id', NEW.id), NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_csv ON users;
CREATE TRIGGER user_csv
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (NEW."csvRequest" <> OLD."csvRequest")
    EXECUTE PROCEDURE csv_check();