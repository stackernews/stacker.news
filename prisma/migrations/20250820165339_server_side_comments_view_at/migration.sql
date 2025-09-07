-- CreateTable
CREATE TABLE "CommentsViewAt" (
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentsViewAt_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateIndex
CREATE INDEX "CommentsViewAt_userId_idx" ON "CommentsViewAt"("userId");

-- AddForeignKey
ALTER TABLE "CommentsViewAt" ADD CONSTRAINT "CommentsViewAt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentsViewAt" ADD CONSTRAINT "CommentsViewAt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION schedule_untrack_old_items()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('untrackOldItems', '0 0 * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_untrack_old_items();
DROP FUNCTION IF EXISTS schedule_untrack_old_items;
