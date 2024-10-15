-- CreateTable
CREATE TABLE "Arc" (
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,
    "zapTrust" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Arc_pkey" PRIMARY KEY ("fromId","toId")
);

-- AddForeignKey
ALTER TABLE "Arc" ADD CONSTRAINT "Arc_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arc" ADD CONSTRAINT "Arc_toId_fkey" FOREIGN KEY ("toId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
