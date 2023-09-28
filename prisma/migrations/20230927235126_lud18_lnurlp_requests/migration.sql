-- CreateTable
CREATE TABLE "LnUrlpRequest" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "k1" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "LnUrlpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LnUrlpRequest.k1_unique" ON "LnUrlpRequest"("k1");

-- AddForeignKey
ALTER TABLE "LnUrlpRequest" ADD CONSTRAINT "LnUrlpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
