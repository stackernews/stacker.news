-- AlterTable
ALTER TABLE "users" ADD COLUMN     "infected" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Infection" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemActId" INTEGER,
    "infecteeId" INTEGER NOT NULL,
    "infectorId" INTEGER,

    CONSTRAINT "Infection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Infection_patient_zero_check" CHECK (
        CASE
            WHEN id <= 4 THEN true
            ELSE "infectorId" IS NOT NULL
        END
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Infection_infecteeId_unique" ON "Infection"("infecteeId");

-- CreateIndex
CREATE UNIQUE INDEX "Infection_itemActId_unique" ON "Infection"("itemActId");

-- CreateIndex
CREATE INDEX "Infection_infectorId_idx" ON "Infection"("infectorId");

-- AddForeignKey
ALTER TABLE "Infection" ADD CONSTRAINT "Infection_infecteeId_fkey" FOREIGN KEY ("infecteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infection" ADD CONSTRAINT "Infection_infectorId_fkey" FOREIGN KEY ("infectorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infection" ADD CONSTRAINT "Infection_itemActId_fkey" FOREIGN KEY ("itemActId") REFERENCES "ItemAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
