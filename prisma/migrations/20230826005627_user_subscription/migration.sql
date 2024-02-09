-- CreateTable
CREATE TABLE "UserSubscription" (
    "followerId" INTEGER NOT NULL,
    "followeeId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("followerId","followeeId")
);

-- CreateIndex
CREATE INDEX "UserSubscription.created_at_index" ON "UserSubscription"("created_at");

-- CreateIndex
CREATE INDEX "UserSubscription.follower_index" ON "UserSubscription"("followerId");

-- CreateIndex
CREATE INDEX "UserSubscription.followee_index" ON "UserSubscription"("followeeId");

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Can't follow yourself
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_no_follow_self" CHECK ("followerId" <> "followeeId");
