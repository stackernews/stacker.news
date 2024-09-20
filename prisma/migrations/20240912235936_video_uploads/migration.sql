-- rename image_fees_info to upload_fees
-- also give stackers more free quota (50MB per 24 hours -> 250MB per 24 hours)
DROP FUNCTION image_fees_info(user_id INTEGER, upload_ids INTEGER[]);
CREATE OR REPLACE FUNCTION upload_fees(user_id INTEGER, upload_ids INTEGER[])
RETURNS TABLE (
    "bytes24h" INTEGER,
    "bytesUnpaid" INTEGER,
    "nUnpaid" INTEGER,
    "uploadFeesMsats" BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT
        uploadinfo.*,
        CASE
            -- anons always pay 100 sats per upload no matter the size
            WHEN user_id = 27 THEN 100000::BIGINT
            ELSE CASE
            -- 250MB are free per stacker and 24 hours
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 250 * 1024 * 1024 THEN 0::BIGINT
            -- 250MB-500MB: 10 sats per upload
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 500 * 1024 * 1024 THEN 10000::BIGINT
            -- 500MB-1GB: 100 sats per upload
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 1000 * 1024 * 1024 THEN 100000::BIGINT
            -- 1GB+: 1k sats per upload
            ELSE 1000000::BIGINT
        END
    END AS "uploadFeesMsats"
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
