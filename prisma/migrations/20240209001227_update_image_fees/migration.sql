-- update image fees from free 10 MB per stacker per 24 hours to
-- free 50 MB per stacker per 24 hours
CREATE OR REPLACE FUNCTION image_fees_info(user_id INTEGER, upload_ids INTEGER[])
RETURNS TABLE (
    "bytes24h" INTEGER,
    "bytesUnpaid" INTEGER,
    "nUnpaid" INTEGER,
    "imageFeeMsats" BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT
        uploadinfo.*,
        CASE
            -- anons always pay 100 sats per image
            WHEN user_id = 27 THEN 100000::BIGINT
            ELSE CASE
            -- 50 MB are free per stacker and 24 hours
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 50 * 1024 * 1024 THEN 0::BIGINT
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 75 * 1024 * 1024 THEN 10000::BIGINT
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 100 * 1024 * 1024 THEN 100000::BIGINT
            ELSE 1000000::BIGINT
        END
    END AS "imageFeeMsats"
    FROM (
        SELECT
            -- how much bytes did stacker upload in last 24 hours?
            COALESCE(SUM(size) FILTER(WHERE paid = 't' AND created_at >= NOW() - interval '24 hours'), 0)::INTEGER AS "bytes24h",
            -- how much unpaid bytes do they want to upload now?
            COALESCE(SUM(size) FILTER(WHERE paid = 'f' AND id = ANY(upload_ids)), 0)::INTEGER AS "bytesUnpaid",
            -- how many unpaid images do they want to upload now?
            COALESCE(COUNT(id) FILTER(WHERE paid = 'f' AND id = ANY(upload_ids)), 0)::INTEGER AS "nUnpaid"
        FROM "Upload"
        WHERE "Upload"."userId" = user_id
    ) uploadinfo;
    RETURN;
END;
$$;