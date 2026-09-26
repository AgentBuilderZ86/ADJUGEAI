-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBRE');

-- CreateEnum
CREATE TYPE "Palier" AS ENUM ('GRATUIT', 'ESSENTIEL', 'PRO', 'ENTREPRISE');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('ESSAI', 'ACTIF', 'SUSPENDU', 'RESILIE');

-- CreateEnum
CREATE TYPE "TypeMarche" AS ENUM ('TRAVAUX', 'FOURNITURES', 'SERVICES', 'ETUDES');

-- CreateEnum
CREATE TYPE "StatutDossier" AS ENUM ('A_QUALIFIER', 'GO', 'GO_CONDITIONNEL', 'NO_GO', 'EN_PREPARATION', 'DEPOSE', 'GAGNE', 'PERDU', 'INFRUCTUEUX', 'ABANDONNE');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('GO', 'GO_CONDITIONNEL', 'NO_GO_DEFAUT', 'NO_GO');

-- CreateEnum
CREATE TYPE "StatutOffrePv" AS ENUM ('RETENUE', 'EXCESSIVE', 'ANORMALEMENT_BASSE', 'ECARTEE_ADMIN', 'ECARTEE_TECHNIQUE', 'ATTRIBUTAIRE');

-- CreateEnum
CREATE TYPE "StatutPiece" AS ENUM ('MANQUANTE', 'EN_COURS', 'PRETE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "Meteo" AS ENUM ('VERT', 'ORANGE', 'ROUGE');

-- CreateEnum
CREATE TYPE "StatutTache" AS ENUM ('A_FAIRE', 'EN_COURS', 'BLOQUEE', 'TERMINEE');

-- CreateEnum
CREATE TYPE "TypeCaution" AS ENUM ('PROVISOIRE', 'DEFINITIVE', 'RETENUE_GARANTIE', 'AVANCE');

-- CreateEnum
CREATE TYPE "StatutCaution" AS ENUM ('DEMANDEE', 'EMISE', 'EN_COURS', 'MAINLEVEE_DEMANDEE', 'LIBEREE');

-- CreateEnum
CREATE TYPE "StatutDecompte" AS ENUM ('BROUILLON', 'DEPOSE', 'VALIDE', 'ORDONNANCE', 'PAYE', 'CONTESTE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "secteur" TEXT,
    "ville" TEXT,
    "ice" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'MA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBRE',
    "derniereConn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBRE',
    "jeton" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "accepteLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abonnement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "palier" "Palier" NOT NULL DEFAULT 'GRATUIT',
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'ESSAI',
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRenouvellement" TIMESTAMP(3),

    CONSTRAINT "Abonnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "cible" TEXT NOT NULL,
    "avant" JSONB,
    "apres" JSONB,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acheteur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nomNormalise" TEXT NOT NULL,
    "type" TEXT,
    "region" TEXT,

    CONSTRAINT "Acheteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvisAppelOffres" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "referenceSource" TEXT NOT NULL,
    "acheteurId" TEXT,
    "objet" TEXT NOT NULL,
    "typeMarche" "TypeMarche",
    "procedure" TEXT,
    "categorie" TEXT,
    "region" TEXT,
    "estimation" DECIMAL(16,2),
    "cautionProvisoire" DECIMAL(16,2),
    "datePublication" TIMESTAMP(3),
    "dateLimite" TIMESTAMP(3),
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisAppelOffres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PvOuverture" (
    "id" TEXT NOT NULL,
    "avisId" TEXT NOT NULL,
    "dateSeance" TIMESTAMP(3),
    "prixReference" DECIMAL(16,2),
    "infructueux" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PvOuverture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concurrent" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nomNormalise" TEXT NOT NULL,
    "ice" TEXT,

    CONSTRAINT "Concurrent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffrePv" (
    "id" TEXT NOT NULL,
    "pvId" TEXT NOT NULL,
    "concurrentId" TEXT NOT NULL,
    "montant" DECIMAL(16,2) NOT NULL,
    "statut" "StatutOffrePv",

    CONSTRAINT "OffrePv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilVeille" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motsCles" TEXT[],
    "exclusions" TEXT[],
    "regions" TEXT[],
    "typesMarche" "TypeMarche"[],
    "estimationMin" DECIMAL(16,2),
    "estimationMax" DECIMAL(16,2),
    "alerteEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfilVeille_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "avisId" TEXT,
    "titre" TEXT NOT NULL,
    "acheteur" TEXT,
    "typeMarche" "TypeMarche",
    "texteCps" TEXT,
    "estimation" DECIMAL(16,2),
    "dateDepot" TIMESTAMP(3),
    "statut" "StatutDossier" NOT NULL DEFAULT 'A_QUALIFIER',
    "sourceUrl" TEXT,
    "creePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "scoreTotal" INTEGER NOT NULL,
    "scoreParBloc" JSONB NOT NULL,
    "killSwitch" TEXT,
    "verdict" "Verdict" NOT NULL,
    "motifs" JSONB NOT NULL,
    "syntheseIa" JSONB,
    "corrige" BOOLEAN NOT NULL DEFAULT false,
    "creePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRegle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "bloc" TEXT,
    "verdictInitial" "Verdict" NOT NULL,
    "verdictCorrige" "Verdict" NOT NULL,
    "commentaire" TEXT,
    "creePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRegle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationPrix" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dossierId" TEXT,
    "typeMarche" "TypeMarche" NOT NULL,
    "estimation" DECIMAL(16,2) NOT NULL,
    "cout" DECIMAL(16,2),
    "hypotheses" JSONB NOT NULL,
    "prixRecommande" DECIMAL(16,2),
    "probabiliteGain" DOUBLE PRECISION,
    "prixReferenceP50" DECIMAL(16,2),
    "courbe" JSONB NOT NULL,
    "creePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationPrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "lignes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoriqueImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceEntreprise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "fichierUrl" TEXT,
    "delivreLe" TIMESTAMP(3),
    "expireLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceEntreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceRequise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "enveloppe" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "eliminatoire" BOOLEAN NOT NULL DEFAULT false,
    "statut" "StatutPiece" NOT NULL DEFAULT 'MANQUANTE',
    "pieceId" TEXT,
    "responsable" TEXT,

    CONSTRAINT "PieceRequise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMortem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "notreMontant" DECIMAL(16,2),
    "montantGagnant" DECIMAL(16,2),
    "prixReference" DECIMAL(16,2),
    "rang" INTEGER,
    "causes" JSONB,
    "enseignements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMortem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dossierId" TEXT,
    "nom" TEXT NOT NULL,
    "numeroMarche" TEXT,
    "montant" DECIMAL(16,2),
    "meteo" "Meteo" NOT NULL DEFAULT 'VERT',
    "dateOs" TIMESTAMP(3),
    "delaiJours" INTEGER,
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tache" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "responsable" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" "StatutTache" NOT NULL DEFAULT 'A_FAIRE',
    "jalonCle" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceGouvernance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "compteRendu" TEXT,
    "decisions" JSONB,

    CONSTRAINT "InstanceGouvernance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projetId" TEXT,
    "dossierId" TEXT,
    "type" "TypeCaution" NOT NULL,
    "montant" DECIMAL(16,2) NOT NULL,
    "banque" TEXT,
    "statut" "StatutCaution" NOT NULL DEFAULT 'DEMANDEE',
    "emiseLe" TIMESTAMP(3),
    "mainleveePrevueLe" TIMESTAMP(3),

    CONSTRAINT "Caution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decompte" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "montant" DECIMAL(16,2) NOT NULL,
    "statut" "StatutDecompte" NOT NULL DEFAULT 'BROUILLON',
    "deposeLe" TIMESTAMP(3),
    "payeLe" TIMESTAMP(3),
    "interetsMoratoires" DECIMAL(16,2),

    CONSTRAINT "Decompte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compte" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "secteur" TEXT,
    "statutRelation" TEXT NOT NULL DEFAULT 'prospect',
    "scoreInterne" INTEGER,
    "planStrategique" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Compte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "source" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partenaire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "specialites" TEXT[],
    "contact" TEXT,
    "notes" TEXT,

    CONSTRAINT "Partenaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Groupement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dossierId" TEXT,
    "type" TEXT NOT NULL,
    "membres" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Groupement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_jeton_key" ON "Invitation"("jeton");

-- CreateIndex
CREATE INDEX "Invitation_tenantId_idx" ON "Invitation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Abonnement_tenantId_key" ON "Abonnement"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_date_idx" ON "AuditLog"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Acheteur_nomNormalise_key" ON "Acheteur"("nomNormalise");

-- CreateIndex
CREATE INDEX "AvisAppelOffres_dateLimite_idx" ON "AvisAppelOffres"("dateLimite");

-- CreateIndex
CREATE UNIQUE INDEX "AvisAppelOffres_source_referenceSource_key" ON "AvisAppelOffres"("source", "referenceSource");

-- CreateIndex
CREATE UNIQUE INDEX "PvOuverture_avisId_key" ON "PvOuverture"("avisId");

-- CreateIndex
CREATE UNIQUE INDEX "Concurrent_nomNormalise_key" ON "Concurrent"("nomNormalise");

-- CreateIndex
CREATE INDEX "OffrePv_concurrentId_idx" ON "OffrePv"("concurrentId");

-- CreateIndex
CREATE INDEX "ProfilVeille_tenantId_idx" ON "ProfilVeille"("tenantId");

-- CreateIndex
CREATE INDEX "Dossier_tenantId_statut_idx" ON "Dossier"("tenantId", "statut");

-- CreateIndex
CREATE INDEX "Qualification_tenantId_dossierId_idx" ON "Qualification"("tenantId", "dossierId");

-- CreateIndex
CREATE INDEX "FeedbackRegle_tenantId_idx" ON "FeedbackRegle"("tenantId");

-- CreateIndex
CREATE INDEX "SimulationPrix_tenantId_idx" ON "SimulationPrix"("tenantId");

-- CreateIndex
CREATE INDEX "HistoriqueImport_tenantId_idx" ON "HistoriqueImport"("tenantId");

-- CreateIndex
CREATE INDEX "PieceEntreprise_tenantId_expireLe_idx" ON "PieceEntreprise"("tenantId", "expireLe");

-- CreateIndex
CREATE INDEX "PieceRequise_tenantId_dossierId_idx" ON "PieceRequise"("tenantId", "dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "PostMortem_dossierId_key" ON "PostMortem"("dossierId");

-- CreateIndex
CREATE INDEX "PostMortem_tenantId_idx" ON "PostMortem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Projet_dossierId_key" ON "Projet"("dossierId");

-- CreateIndex
CREATE INDEX "Projet_tenantId_idx" ON "Projet"("tenantId");

-- CreateIndex
CREATE INDEX "Tache_tenantId_projetId_idx" ON "Tache"("tenantId", "projetId");

-- CreateIndex
CREATE INDEX "InstanceGouvernance_tenantId_projetId_idx" ON "InstanceGouvernance"("tenantId", "projetId");

-- CreateIndex
CREATE INDEX "Caution_tenantId_idx" ON "Caution"("tenantId");

-- CreateIndex
CREATE INDEX "Decompte_tenantId_statut_idx" ON "Decompte"("tenantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "Decompte_projetId_numero_key" ON "Decompte"("projetId", "numero");

-- CreateIndex
CREATE INDEX "Compte_tenantId_idx" ON "Compte"("tenantId");

-- CreateIndex
CREATE INDEX "Signal_tenantId_compteId_idx" ON "Signal"("tenantId", "compteId");

-- CreateIndex
CREATE INDEX "Partenaire_tenantId_idx" ON "Partenaire"("tenantId");

-- CreateIndex
CREATE INDEX "Groupement_tenantId_idx" ON "Groupement"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisAppelOffres" ADD CONSTRAINT "AvisAppelOffres_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "Acheteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PvOuverture" ADD CONSTRAINT "PvOuverture_avisId_fkey" FOREIGN KEY ("avisId") REFERENCES "AvisAppelOffres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffrePv" ADD CONSTRAINT "OffrePv_pvId_fkey" FOREIGN KEY ("pvId") REFERENCES "PvOuverture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffrePv" ADD CONSTRAINT "OffrePv_concurrentId_fkey" FOREIGN KEY ("concurrentId") REFERENCES "Concurrent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilVeille" ADD CONSTRAINT "ProfilVeille_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_avisId_fkey" FOREIGN KEY ("avisId") REFERENCES "AvisAppelOffres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRegle" ADD CONSTRAINT "FeedbackRegle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationPrix" ADD CONSTRAINT "SimulationPrix_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationPrix" ADD CONSTRAINT "SimulationPrix_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueImport" ADD CONSTRAINT "HistoriqueImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceEntreprise" ADD CONSTRAINT "PieceEntreprise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceRequise" ADD CONSTRAINT "PieceRequise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceRequise" ADD CONSTRAINT "PieceRequise_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMortem" ADD CONSTRAINT "PostMortem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMortem" ADD CONSTRAINT "PostMortem_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceGouvernance" ADD CONSTRAINT "InstanceGouvernance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceGouvernance" ADD CONSTRAINT "InstanceGouvernance_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caution" ADD CONSTRAINT "Caution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caution" ADD CONSTRAINT "Caution_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decompte" ADD CONSTRAINT "Decompte_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decompte" ADD CONSTRAINT "Decompte_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compte" ADD CONSTRAINT "Compte_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "Compte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partenaire" ADD CONSTRAINT "Partenaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Groupement" ADD CONSTRAINT "Groupement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
