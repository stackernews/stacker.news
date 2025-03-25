-- CreateTable
CREATE TABLE "AutoSocialPost" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "AutoSocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoSocialPost_itemId_idx" ON "AutoSocialPost"("itemId");

-- CreateIndex
CREATE INDEX "AutoSocialPost_created_at_idx" ON "AutoSocialPost"("created_at");

-- AddForeignKey
ALTER TABLE "AutoSocialPost" ADD CONSTRAINT "AutoSocialPost_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION schedule_social_poster_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- 10 minutes after midnight
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('socialPoster', '*/60 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_social_poster_job();
DROP FUNCTION IF EXISTS schedule_social_poster_job;