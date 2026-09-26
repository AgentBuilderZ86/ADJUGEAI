import type { Palier, Prisma, TypeMarche as TypeMarcheDb } from "@prisma/client";
import { z } from "zod";
import { calibrer, simulerPrix, type ModeleConcurrence, type ResultatHistorique } from "@/lib/marches/simulation";
import { PALIERS } from "@/lib/paliers";
import type { TenantDb } from "@/lib/tenant";

export class QuotaSimulationsAtteint extends Error {}

const TYPES = ["travaux", "fournitures", "services"] as const;
export type TypeChiffrable = (typeof TYPES)[number];

export const TYPE_DB: Record<TypeChiffrable, TypeMarcheDb> = { travaux: "TRAVAUX", fournitures: "FOURNITURES", services: "SERVICES" };

/** Paramètres d'une simulation, tels que saisis dans le calculateur. Le calcul est refait côté serveur. */
export const schemaParametres = z.object({
  type: z.enum(TYPES),
  estimation: z.number().positive(),
  cout: z.number().positive().optional(),
  modele: z.object({
    nombreConcurrents: z.object({ min: z.number().int().min(0).max(60), max: z.number().int().min(0).max(60) }),
    distribution: z.discriminatedUnion("type", [
      z.object({ type: z.literal("normale"), moyenne: z.number().min(0.3).max(2), ecartType: z.number().min(0.001).max(1) }),
      z.object({ type: z.literal("empirique"), ratios: z.array(z.number().min(0.05).max(5)).min(1).max(20000) }),
    ]),
  }),
  dossierId: z.string().min(1).optional(),
});

export type ParametresSimulation = z.infer<typeof schemaParametres>;

function debutDuMois(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function quotaSimulations(db: TenantDb, tenantId: string) {
  const abonnement = await db.abonnement.findUnique({ where: { tenantId } });
  const palier: Palier = abonnement?.palier ?? "GRATUIT";
  const limite = PALIERS.find((p) => p.cle === palier)?.limites.simulationsParMois ?? null;
  const utilisees = await db.auditLog.count({ where: { action: "simulation.creation", date: { gte: debutDuMois() } } });
  return { palier, limite, utilisees, restantes: limite === null ? null : Math.max(0, limite - utilisees) };
}

/**
 * Enregistre une simulation : le calcul est refait ici (graine fixe, résultat reproductible),
 * jamais repris du navigateur. Le dossier éventuel doit appartenir au cabinet.
 */
export async function enregistrerSimulation(params: { db: TenantDb; tenantId: string; userId: string; parametres: ParametresSimulation }) {
  const { db, tenantId, userId } = params;
  const p = schemaParametres.parse(params.parametres);

  const quota = await quotaSimulations(db, tenantId);
  if (quota.restantes === 0) {
    throw new QuotaSimulationsAtteint(
      `Vous avez enregistré vos ${quota.limite} simulations du mois (offre ${quota.palier}). Le calculateur reste utilisable sans enregistrement.`,
    );
  }
  if (p.dossierId && !(await db.dossier.findUnique({ where: { id: p.dossierId } }))) {
    throw new Error("Dossier introuvable.");
  }

  const modele: ModeleConcurrence = {
    nombreConcurrents: { min: Math.min(p.modele.nombreConcurrents.min, p.modele.nombreConcurrents.max), max: Math.max(p.modele.nombreConcurrents.min, p.modele.nombreConcurrents.max) },
    distribution: p.modele.distribution,
  };
  const r = simulerPrix({ type: p.type, estimation: p.estimation, modele, cout: p.cout, iterations: 4000, graine: 42 });

  return db.$transaction(async (tx) => {
    const simulation = await tx.simulationPrix.create({
      data: {
        tenantId,
        dossierId: p.dossierId ?? null,
        typeMarche: TYPE_DB[p.type],
        estimation: p.estimation,
        cout: p.cout ?? null,
        hypotheses: {
          modele: {
            nombreConcurrents: modele.nombreConcurrents,
            distribution:
              modele.distribution.type === "normale"
                ? modele.distribution
                : { type: "empirique", echantillons: modele.distribution.ratios.length },
          },
          critere: r.critere,
          iterations: r.iterations,
          graine: 42,
        } as Prisma.InputJsonValue,
        prixRecommande: r.recommandation?.prix ?? null,
        probabiliteGain: r.recommandation?.probabiliteGain ?? null,
        prixReferenceP50: r.prixReferenceSimule?.p50 ?? null,
        courbe: r.points.map((pt) => [pt.ratio, Math.round(pt.probabiliteGain * 10000) / 10000, pt.margeEsperee === null ? null : Math.round(pt.margeEsperee)]),
        creePar: userId,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "simulation.creation",
        cible: `SimulationPrix:${simulation.id}`,
        apres: { dossierId: p.dossierId ?? null, prixRecommande: r.recommandation?.prix ?? null },
      },
    });
    return simulation;
  });
}

export async function supprimerSimulation(params: { db: TenantDb; tenantId: string; userId: string; simulationId: string }) {
  const { db, tenantId, userId, simulationId } = params;
  const s = await db.simulationPrix.findUnique({ where: { id: simulationId } });
  if (!s) throw new Error("Simulation introuvable.");
  await db.$transaction([
    db.simulationPrix.delete({ where: { id: s.id } }),
    db.auditLog.create({ data: { tenantId, userId, action: "simulation.suppression", cible: `SimulationPrix:${s.id}` } }),
  ]);
}

// ───────────────────────── Historique du cabinet ─────────────────────────

export interface LigneHistorique extends ResultatHistorique {
  typeMarche: TypeChiffrable;
}

const schemaLignes = z
  .array(
    z.object({
      estimation: z.number().positive(),
      offres: z.array(z.number().positive()).min(1).max(100),
      typeMarche: z.enum(TYPES),
    }),
  )
  .min(1, "Aucune ligne exploitable.")
  .max(2000, "2 000 lignes maximum par import.");

export async function importerHistorique(params: { db: TenantDb; tenantId: string; userId: string; nom: string; lignes: LigneHistorique[] }) {
  const { db, tenantId, userId } = params;
  const lignes = schemaLignes.parse(params.lignes);
  const nom = params.nom.trim() || `Import du ${new Date().toLocaleDateString("fr-FR")}`;
  return db.$transaction(async (tx) => {
    const imp = await tx.historiqueImport.create({ data: { tenantId, nom, lignes } });
    await tx.auditLog.create({
      data: { tenantId, userId, action: "historique.import", cible: `HistoriqueImport:${imp.id}`, apres: { nom, lignes: lignes.length } },
    });
    return imp;
  });
}

export async function supprimerHistorique(params: { db: TenantDb; tenantId: string; userId: string; importId: string }) {
  const { db, tenantId, userId, importId } = params;
  const imp = await db.historiqueImport.findUnique({ where: { id: importId } });
  if (!imp) throw new Error("Import introuvable.");
  await db.$transaction([
    db.historiqueImport.delete({ where: { id: imp.id } }),
    db.auditLog.create({ data: { tenantId, userId, action: "historique.suppression", cible: `HistoriqueImport:${imp.id}`, avant: { nom: imp.nom } } }),
  ]);
}

/** Toutes les lignes d'historique du cabinet (tous imports confondus). */
export async function historiqueDuCabinet(db: TenantDb): Promise<LigneHistorique[]> {
  const imports = await db.historiqueImport.findMany({ orderBy: { createdAt: "asc" } });
  return imports.flatMap((i) => {
    const r = schemaLignes.safeParse(i.lignes);
    return r.success ? r.data : [];
  });
}

export function resumeHistorique(lignes: LigneHistorique[]) {
  return Object.fromEntries(
    TYPES.map((t) => {
      const c = calibrer(lignes.filter((l) => l.typeMarche === t));
      return [t, c ? { ao: c.echantillons, offres: c.ratios.length, moyenne: c.moyenne } : null];
    }),
  ) as Record<TypeChiffrable, { ao: number; offres: number; moyenne: number } | null>;
}
