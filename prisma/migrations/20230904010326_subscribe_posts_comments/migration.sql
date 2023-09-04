-- AlterTable
ALTER TABLE "UserSubscription"
ADD COLUMN     "comments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "posts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "commentsUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "postsUpdatedAt" TIMESTAMP(3);

-- Set the individual post and comment times based on the original creation time for pre-existing subscriptions
UPDATE "UserSubscription"
SET "commentsUpdatedAt" = "UserSubscription".created_at,
"postsUpdatedAt" = "UserSubscription".created_at;