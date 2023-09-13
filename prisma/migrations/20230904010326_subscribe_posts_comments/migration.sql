-- AlterTable
ALTER TABLE "UserSubscription"
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "commentsSubscribedAt" TIMESTAMP(3),
ADD COLUMN     "postsSubscribedAt" TIMESTAMP(3);

-- Set the individual post and comment times based on the original creation time for pre-existing subscriptions
UPDATE "UserSubscription"
SET "commentsSubscribedAt" = "UserSubscription".created_at,
"postsSubscribedAt" = "UserSubscription".created_at;