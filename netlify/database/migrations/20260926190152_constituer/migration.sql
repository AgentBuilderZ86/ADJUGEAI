-- AlterTable
ALTER TABLE "PieceEntreprise" ADD COLUMN     "numero" TEXT;

-- AlterTable
ALTER TABLE "PieceRequise" ADD COLUMN     "ordre" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "typePiece" TEXT;
