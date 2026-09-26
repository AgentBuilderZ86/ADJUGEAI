-- AlterTable
ALTER TABLE "AvisAppelOffres" ADD COLUMN     "detailLe" TIMESTAMP(3),
ADD COLUMN     "lieu" TEXT;

-- CreateTable
CREATE TABLE "CollecteVeille" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "lus" INTEGER NOT NULL DEFAULT 0,
    "nouveaux" INTEGER NOT NULL DEFAULT 0,
    "details" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "declenchePar" TEXT,

    CONSTRAINT "CollecteVeille_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollecteVeille_source_debut_idx" ON "CollecteVeille"("source", "debut");

-- CreateIndex
CREATE INDEX "AvisAppelOffres_datePublication_idx" ON "AvisAppelOffres"("datePublication");
