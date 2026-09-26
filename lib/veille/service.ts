import type { PrismaClient, TypeMarche } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant";
import { normaliser, pertinence, typeDepuisCategorie, type CriteresVeille } from "./correspondance";
import { collecterDetail, collecterRecents, CollecteInterrompue, SessionPmmp, type AvisBrut } from "./pmmp";

export const SOURCE_PMMP = "pmmp";
export const SOURCE_RATTRAPAGE = "pmmp-rattrapage";

/** Écart minimal entre deux collectes (respect du portail). */
export const INTERVALLE_MIN_MINUTES = 60;

// ───────────────────────────── Collecte ─────────────────────────────

/** Enregistre (ou met à jour) les avis lus. Idempotent : clé (source, référence de consultation). */
export async function enregistrerAvis(prisma: PrismaClient, avis: AvisBrut[]) {
  let nouveaux = 0;
  for (const a of avis) {
    let acheteurId: string | null = null;
    if (a.acheteur) {
      const nomNormalise = normaliser(a.acheteur);
      acheteurId = (
        await prisma.acheteur.upsert({ where: { nomNormalise }, update: {}, create: { nom: a.acheteur, nomNormalise } })
      ).id;
    }
    const donnees = {
      objet: a.objet,
      acheteurId,
      typeMarche: typeDepuisCategorie(a.categorie, a.objet),
      procedure: a.procedure,
      categorie: a.categorie,
      lieu: a.lieu,
      datePublication: a.datePublication,
      dateLimite: a.dateLimite,
      url: a.url,
    };
    const cle = { source_referenceSource: { source: SOURCE_PMMP, referenceSource: `${a.orgAcronyme}:${a.refConsultation}` } };
    const existant = await prisma.avisAppelOffres.findUnique({ where: cle, select: { id: true } });
    if (existant) {
      await prisma.avisAppelOffres.update({ where: { id: existant.id }, data: donnees });
    } else {
      await prisma.avisAppelOffres.create({
        data: { source: SOURCE_PMMP, referenceSource: `${a.orgAcronyme}:${a.refConsultation}`, ...donnees },
      });
      nouveaux++;
    }
  }
  return { lus: avis.length, nouveaux };
}

/** Complète estimation et caution des avis encore ouverts dont la fiche n'a pas été lue. */
export async function completerDetails(prisma: PrismaClient, session: SessionPmmp, max: number) {
  const aCompleter = await prisma.avisAppelOffres.findMany({
    where: { source: SOURCE_PMMP, detailLe: null, dateLimite: { gt: new Date() } },
    orderBy: { datePublication: "desc" },
    take: max,
    select: { id: true, referenceSource: true },
  });
  let n = 0;
  for (const a of aCompleter) {
    const [orgAcronyme, refConsultation] = a.referenceSource.split(":");
    const d = await collecterDetail(session, { orgAcronyme, refConsultation });
    await prisma.avisAppelOffres.update({
      where: { id: a.id },
      data: { estimation: d.estimation, cautionProvisoire: d.cautionProvisoire, detailLe: new Date() },
    });
    n++;
  }
  return n;
}

export class CollecteTropRapprochee extends Error {}

export async function derniereCollecte(prisma: PrismaClient) {
  return prisma.collecteVeille.findFirst({ where: { source: SOURCE_PMMP }, orderBy: { debut: "desc" } });
}

/**
 * Collecte complète : avis les plus récents puis quelques fiches détail, tracée dans CollecteVeille.
 * Refuse de s'exécuter moins de INTERVALLE_MIN_MINUTES après la précédente.
 */
export async function collecter(
  prisma: PrismaClient,
  options: { declenchePar: string; details?: number; session?: SessionPmmp; maintenant?: Date },
) {
  const maintenant = options.maintenant ?? new Date();
  const derniere = await derniereCollecte(prisma);
  if (derniere && maintenant.getTime() - derniere.debut.getTime() < INTERVALLE_MIN_MINUTES * 60_000) {
    throw new CollecteTropRapprochee(
      `Dernière collecte il y a moins de ${INTERVALLE_MIN_MINUTES} minutes (${derniere.debut.toLocaleString("fr-FR")}).`,
    );
  }
  const journal = await prisma.collecteVeille.create({ data: { source: SOURCE_PMMP, declenchePar: options.declenchePar, debut: maintenant } });
  const session = options.session ?? new SessionPmmp();
  let bilan = { lus: 0, nouveaux: 0, details: 0 };
  try {
    const avis = await collecterRecents(session, 50);
    bilan = { ...bilan, ...(await enregistrerAvis(prisma, avis)) };
    bilan.details = options.details ? await completerDetails(prisma, session, options.details) : 0;
    return await prisma.collecteVeille.update({ where: { id: journal.id }, data: { ...bilan, statut: "ok", fin: new Date() } });
  } catch (e) {
    const statut = e instanceof CollecteInterrompue ? "interrompue" : "erreur";
    await prisma.collecteVeille.update({
      where: { id: journal.id },
      data: { ...bilan, statut, fin: new Date(), message: (e as Error).message.slice(0, 500) },
    });
    throw e;
  }
}

// ───────────────────────────── Profils et correspondances ─────────────────────────────

export function criteresDuProfil(p: {
  motsCles: string[];
  exclusions: string[];
  regions: string[];
  typesMarche: TypeMarche[];
  estimationMin: unknown;
  estimationMax: unknown;
}): CriteresVeille {
  return {
    motsCles: p.motsCles,
    exclusions: p.exclusions,
    regions: p.regions,
    typesMarche: p.typesMarche,
    estimationMin: p.estimationMin == null ? null : Number(p.estimationMin),
    estimationMax: p.estimationMax == null ? null : Number(p.estimationMax),
  };
}

export async function enregistrerProfilVeille(params: {
  db: TenantDb;
  tenantId: string;
  userId: string;
  criteres: CriteresVeille;
  alerteEmail: boolean;
}) {
  const { db, tenantId, userId, criteres, alerteEmail } = params;
  const existant = await db.profilVeille.findFirst({ orderBy: { createdAt: "asc" } });
  const data = { ...criteres, alerteEmail };
  const profil = existant
    ? await db.profilVeille.update({ where: { id: existant.id }, data })
    : await db.profilVeille.create({ data: { tenantId, nom: "Profil principal", ...data } });
  await db.auditLog.create({
    data: { tenantId, userId, action: "veille.profil", cible: `ProfilVeille:${profil.id}`, apres: { ...criteres, alerteEmail } },
  });
  return profil;
}

export interface AvisPertinent {
  id: string;
  objet: string;
  acheteur: string | null;
  lieu: string | null;
  typeMarche: TypeMarche | null;
  procedure: string | null;
  estimation: number | null;
  cautionProvisoire: number | null;
  datePublication: Date | null;
  dateLimite: Date | null;
  url: string | null;
  score: number;
  dossierId: string | null;
}

/** Avis ouverts correspondant au profil du cabinet, du plus pertinent au plus récent. */
export async function avisPertinents(prisma: PrismaClient, db: TenantDb, limite = 100): Promise<{ profil: boolean; avis: AvisPertinent[] }> {
  const profil = await db.profilVeille.findFirst({ orderBy: { createdAt: "asc" } });
  if (!profil) return { profil: false, avis: [] };
  const criteres = criteresDuProfil(profil);

  const candidats = await prisma.avisAppelOffres.findMany({
    where: { dateLimite: { gt: new Date() } },
    orderBy: { datePublication: "desc" },
    take: 2000,
    include: { acheteur: { select: { nom: true } } },
  });
  const suivis = new Map(
    (await db.dossier.findMany({ where: { avisId: { in: candidats.map((c) => c.id) } }, select: { id: true, avisId: true } })).map((d) => [
      d.avisId,
      d.id,
    ]),
  );

  const avis: AvisPertinent[] = [];
  for (const c of candidats) {
    const estimation = c.estimation === null ? null : Number(c.estimation);
    const score = pertinence({ objet: c.objet, acheteur: c.acheteur?.nom ?? null, lieu: c.lieu, typeMarche: c.typeMarche, estimation }, criteres);
    if (score === null) continue;
    avis.push({
      id: c.id,
      objet: c.objet,
      acheteur: c.acheteur?.nom ?? null,
      lieu: c.lieu,
      typeMarche: c.typeMarche,
      procedure: c.procedure,
      estimation,
      cautionProvisoire: c.cautionProvisoire === null ? null : Number(c.cautionProvisoire),
      datePublication: c.datePublication,
      dateLimite: c.dateLimite,
      url: c.url,
      score,
      dossierId: suivis.get(c.id) ?? null,
    });
  }
  avis.sort((a, b) => b.score - a.score || (b.datePublication?.getTime() ?? 0) - (a.datePublication?.getTime() ?? 0));
  return { profil: true, avis: avis.slice(0, limite) };
}

/** Crée un dossier à partir d'un avis de la veille (à qualifier ensuite avec le RC/CPS). */
export async function suivreAvis(params: { prisma: PrismaClient; db: TenantDb; tenantId: string; userId: string; avisId: string }) {
  const { prisma, db, tenantId, userId, avisId } = params;
  const deja = await db.dossier.findFirst({ where: { avisId } });
  if (deja) return deja;
  const a = await prisma.avisAppelOffres.findUnique({ where: { id: avisId }, include: { acheteur: true } });
  if (!a) throw new Error("Avis introuvable.");
  return db.$transaction(async (tx) => {
    const dossier = await tx.dossier.create({
      data: {
        tenantId,
        avisId: a.id,
        titre: a.objet.slice(0, 200),
        acheteur: a.acheteur?.nom ?? null,
        typeMarche: a.typeMarche,
        estimation: a.estimation,
        dateDepot: a.dateLimite,
        sourceUrl: a.url,
        statut: "A_QUALIFIER",
        creePar: userId,
      },
    });
    await tx.auditLog.create({ data: { tenantId, userId, action: "veille.suivi", cible: `Dossier:${dossier.id}`, apres: { avisId } } });
    return dossier;
  });
}

// ───────────────────────────── Rattrapage des pages anciennes ─────────────────────────────

/** Nombre maximal de pages parcourues par exécution (100 avis chacune). */
export const PAGES_PAR_RATTRAPAGE = 10;

/**
 * Ouvre une session de rattrapage : reprend après la dernière page parcourue.
 * Une fois toutes les consultations ouvertes couvertes (statut « complet »), un nouveau cycle
 * ne recommence qu'après 24 h. Refuse si un rattrapage a démarré il y a moins de 60 minutes.
 */
export async function ouvrirRattrapage(prisma: PrismaClient, maintenant = new Date()) {
  const dernier = await prisma.collecteVeille.findFirst({ where: { source: SOURCE_RATTRAPAGE }, orderBy: { debut: "desc" } });
  if (dernier && maintenant.getTime() - dernier.debut.getTime() < INTERVALLE_MIN_MINUTES * 60_000) {
    return { actif: false as const, raison: "rattrapage récent" };
  }
  if (dernier?.statut === "complet" && dernier.fin && maintenant.getTime() - dernier.fin.getTime() < 24 * 3_600_000) {
    return { actif: false as const, raison: "cycle complet depuis moins de 24 h" };
  }
  const pageDepart = dernier && dernier.statut !== "complet" && dernier.page ? dernier.page + 1 : 2;
  const journal = await prisma.collecteVeille.create({
    data: { source: SOURCE_RATTRAPAGE, declenchePar: "planification", page: pageDepart - 1, debut: maintenant },
  });
  return { actif: true as const, journalId: journal.id, pageDepart, pagesMax: PAGES_PAR_RATTRAPAGE };
}

/**
 * Enregistre une page lue par la fonction d'arrière-plan. Le cycle est « complet » quand une page
 * ne contient plus aucune consultation ouverte (ou est vide) : inutile de remonter plus loin.
 */
export async function enregistrerPageRattrapage(
  prisma: PrismaClient,
  params: { journalId: string; page: number; avis: AvisBrut[]; derniere: boolean; maintenant?: Date },
) {
  const maintenant = params.maintenant ?? new Date();
  const journal = await prisma.collecteVeille.findUnique({ where: { id: params.journalId } });
  if (!journal || journal.source !== SOURCE_RATTRAPAGE || journal.statut !== "en_cours") throw new Error("Rattrapage introuvable ou clos.");
  const { lus, nouveaux } = await enregistrerAvis(prisma, params.avis);
  const ouverts = params.avis.filter((a) => a.dateLimite && a.dateLimite > maintenant).length;
  const complet = params.avis.length === 0 || ouverts === 0;
  const statut = complet ? "complet" : params.derniere ? "ok" : "en_cours";
  await prisma.collecteVeille.update({
    where: { id: journal.id },
    data: {
      page: params.page,
      lus: journal.lus + lus,
      nouveaux: journal.nouveaux + nouveaux,
      statut,
      ...(statut !== "en_cours" ? { fin: maintenant } : {}),
    },
  });
  return { continuer: statut === "en_cours" };
}

export async function interrompreRattrapage(prisma: PrismaClient, journalId: string, message: string) {
  await prisma.collecteVeille.updateMany({
    where: { id: journalId, source: SOURCE_RATTRAPAGE, statut: "en_cours" },
    data: { statut: "interrompue", fin: new Date(), message: message.slice(0, 500) },
  });
}
