-- CreateTable
CREATE TABLE "SubSubscription" (
    "userId" INTEGER NOT NULL,
    "subName" CITEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubSubscription_pkey" PRIMARY KEY ("userId","subName")
);

-- CreateIndex
CREATE INDEX "SubSubscription.created_at_index" ON "SubSubscription"("created_at");

-- AddForeignKey
ALTER TABLE "SubSubscription" ADD CONSTRAINT "SubSubscription_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSubscription" ADD CONSTRAINT "SubSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
