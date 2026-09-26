import type { Palier, Prisma, StatutDossier, Verdict } from "@prisma/client";
import { PALIERS } from "@/lib/paliers";
import type { TenantDb } from "@/lib/tenant";
import type { AnalyseAo, EntreeAnalyse } from "./analyse";
import { appliquerGrille, BLOCS, type CleBloc, type CleKillSwitch } from "./grille";
import { profilDepuis, type ProfilEntreprise } from "./profil";

export class QuotaAtteint extends Error {}
export class DocumentNonPertinent extends Error {}

const STATUT_PAR_VERDICT: Record<Verdict, StatutDossier> = {
  GO: "GO",
  GO_CONDITIONNEL: "GO_CONDITIONNEL",
  NO_GO_DEFAUT: "NO_GO",
  NO_GO: "NO_GO",
};

function debutDuMois(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function quotaQualifications(db: TenantDb, tenantId: string) {
  const abonnement = await db.abonnement.findUnique({ where: { tenantId } });
  const palier: Palier = abonnement?.palier ?? "GRATUIT";
  const limite = PALIERS.find((p) => p.cle === palier)?.limites.qualificationsParMois ?? null;
  // Compté sur le journal d'audit : supprimer un dossier ne rend pas de qualification.
  const utilisees = await db.auditLog.count({ where: { action: "qualification.creation", date: { gte: debutDuMois() } } });
  return { palier, limite, utilisees, restantes: limite === null ? null : Math.max(0, limite - utilisees) };
}

/**
 * Qualifie un AO : analyse assistée, application de la grille, enregistrement du dossier,
 * de la qualification et de la trace d'audit. `analyser` est injecté (API Claude en production).
 */
export async function qualifierAo(params: {
  db: TenantDb;
  tenantId: string;
  userId: string;
  entree: Omit<EntreeAnalyse, "profil">;
  titre?: string;
  analyser: (entree: EntreeAnalyse) => Promise<AnalyseAo>;
}) {
  const { db, tenantId, userId, entree, analyser } = params;
  const quota = await quotaQualifications(db, tenantId);
  if (quota.restantes === 0) {
    throw new QuotaAtteint(
      `Vous avez utilisé vos ${quota.limite} qualifications du mois (offre ${quota.palier}). Passez à l'offre Essentiel pour un usage illimité.`,
    );
  }

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  const profil = profilDepuis(tenant?.profil);
  const analyse = await analyser({ ...entree, profil });
  if (analyse.nature === "AUTRE") {
    // Rien n'est enregistré ni décompté : le document n'est pas un dossier d'AO.
    throw new DocumentNonPertinent(
      `Ce document ne semble pas être un dossier d'appel d'offres (${analyse.natureExplication.trim() || "nature non reconnue"}). Joignez l'avis, le règlement de consultation ou le CPS.`,
    );
  }

  const grille = appliquerGrille({
    notes: Object.fromEntries(BLOCS.map((b) => [b.cle, analyse.blocs[b.cle].note])) as Record<CleBloc, number>,
    killSwitches: Object.fromEntries(
      Object.entries(analyse.killSwitches).map(([k, v]) => [k, v.actif]),
    ) as Record<CleKillSwitch, boolean>,
  });

  const motifs = {
    blocs: Object.fromEntries(BLOCS.map((b) => [b.cle, analyse.blocs[b.cle]])),
    killSwitches: analyse.killSwitches,
    pointsForts: analyse.pointsForts,
    pointsVigilance: analyse.pointsVigilance,
  };
  const f = analyse.fiche;

  return db.$transaction(async (tx) => {
    const dossier = await tx.dossier.create({
      data: {
        tenantId,
        titre: params.titre?.trim() || f.objet.slice(0, 200),
        acheteur: f.acheteur,
        typeMarche: f.typeMarche,
        texteCps: entree.texte?.trim() || null,
        estimation: f.estimationMad,
        dateDepot: dateOuNull(f.dateLimite),
        statut: STATUT_PAR_VERDICT[grille.verdict],
        creePar: userId,
      },
    });
    const qualification = await tx.qualification.create({
      data: {
        tenantId,
        dossierId: dossier.id,
        scoreTotal: grille.scoreTotal,
        scoreParBloc: grille.scoreParBloc,
        killSwitch: grille.killSwitchesActifs.join(",") || null,
        verdict: grille.verdict,
        motifs: motifs as Prisma.InputJsonValue,
        syntheseIa: {
          fiche: f,
          resume: analyse.resume,
          criteresEliminatoires: analyse.criteresEliminatoires,
          referencesExigees: analyse.referencesExigees,
          qualificationsExigees: analyse.qualificationsExigees,
          risquesContractuels: analyse.risquesContractuels,
          questionsAcheteur: analyse.questionsAcheteur,
          informationsManquantes: analyse.informationsManquantes,
          scoreBrut: grille.scoreBrut,
        } as Prisma.InputJsonValue,
        creePar: userId,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "qualification.creation",
        cible: `Dossier:${dossier.id}`,
        apres: { verdict: grille.verdict, score: grille.scoreTotal },
      },
    });
    return { dossier, qualification };
  });
}

/**
 * Suppression définitive d'un dossier et de tout ce qui s'y rattache (qualifications, simulations,
 * pièces, post-mortem) — droit à l'effacement (loi 09-08). La trace d'audit ne conserve que l'intitulé.
 */
export async function supprimerDossier(params: { db: TenantDb; tenantId: string; userId: string; dossierId: string }) {
  const { db, tenantId, userId, dossierId } = params;
  const dossier = await db.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier) throw new Error("Dossier introuvable.");
  await db.$transaction(async (tx) => {
    const qualifications = await tx.qualification.findMany({ where: { dossierId }, select: { id: true } });
    await tx.feedbackRegle.deleteMany({ where: { qualificationId: { in: qualifications.map((q) => q.id) } } });
    await tx.dossier.delete({ where: { id: dossierId } });
    await tx.auditLog.create({
      data: { tenantId, userId, action: "dossier.suppression", cible: `Dossier:${dossierId}`, avant: { titre: dossier.titre } },
    });
  });
}

/** Correction manuelle d'un verdict : trace le retour pour l'ajustement de la grille (FeedbackRegle). */
export async function corrigerVerdict(params: {
  db: TenantDb;
  tenantId: string;
  userId: string;
  qualificationId: string;
  verdict: Verdict;
  commentaire: string;
}) {
  const { db, tenantId, userId, qualificationId, verdict, commentaire } = params;
  const q = await db.qualification.findUnique({ where: { id: qualificationId } });
  if (!q) throw new Error("Qualification introuvable.");
  if (q.verdict === verdict) return q;

  return db.$transaction(async (tx) => {
    await tx.feedbackRegle.create({
      data: { tenantId, qualificationId, verdictInitial: q.verdict, verdictCorrige: verdict, commentaire, creePar: userId },
    });
    const maj = await tx.qualification.update({ where: { id: q.id }, data: { verdict, corrige: true } });
    await tx.dossier.update({ where: { id: q.dossierId }, data: { statut: STATUT_PAR_VERDICT[verdict] } });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "qualification.correction",
        cible: `Qualification:${q.id}`,
        avant: { verdict: q.verdict },
        apres: { verdict, commentaire },
      },
    });
    return maj;
  });
}

export async function enregistrerProfil(params: { db: TenantDb; tenantId: string; userId: string; profil: ProfilEntreprise }) {
  const { db, tenantId, userId, profil } = params;
  const avant = await db.tenant.findUnique({ where: { id: tenantId } });
  await db.$transaction([
    db.tenant.update({ where: { id: tenantId }, data: { profil } }),
    db.auditLog.create({
      data: { tenantId, userId, action: "profil.modification", cible: `Tenant:${tenantId}`, avant: avant?.profil ?? undefined, apres: profil },
    }),
  ]);
}

function dateOuNull(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}
