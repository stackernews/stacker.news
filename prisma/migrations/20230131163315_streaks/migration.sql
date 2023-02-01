-- CreateTable
CREATE TABLE "Streak" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Streak.userId_index" ON "Streak"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Streak.startedAt_userId_unique" ON "Streak"("startedAt", "userId");

-- AddForeignKey
ALTER TABLE "Streak" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
