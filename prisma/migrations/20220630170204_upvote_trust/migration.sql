-- AlterTable
ALTER TABLE "users" ADD COLUMN "upvoteTrust" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION confidence(successes FLOAT, trials FLOAT, z FLOAT)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
    p FLOAT;
    lhand FLOAT;
    rhand FLOAT;
    under FLOAT;
BEGIN
    IF trials = 0 THEN
        RETURN 0;
    END IF;

    p := successes / trials;
    lhand := p + 1 / (2 * trials) * z * z;
    rhand := z * sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials));
    under := 1 + 1 / trials * z * z;

    RETURN (lhand - rhand) / under;
END;
$$;
