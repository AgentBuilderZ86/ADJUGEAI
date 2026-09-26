import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionPmmp } from "@/lib/veille/pmmp";
import {
  avisPertinents,
  collecter,
  CollecteTropRapprochee,
  enregistrerAvis,
  enregistrerPageRattrapage,
  enregistrerProfilVeille,
  interrompreRattrapage,
  ouvrirRattrapage,
  SOURCE_PMMP,
  SOURCE_RATTRAPAGE,
  suivreAvis,
} from "@/lib/veille/service";
import { lireListe } from "@/lib/veille/pmmp";
import { tenantDb } from "@/lib/tenant";

const base = new PrismaClient();
const liste = readFileSync("tests/fixtures/pmmp-liste.html", "utf8");
const detail = readFileSync("tests/fixtures/pmmp-detail.html", "utf8");
let A: string;
let B: string;

/** Portail simulé : liste pour la recherche, fiche pour le détail ; `statut` forcé si fourni. */
function portail(statut?: number) {
  const urls: string[] = [];
  const f = (async (url: string) => {
    urls.push(url);
    if (statut) return new Response("bloqué", { status: statut });
    return new Response(url.includes("EntrepriseDetailConsultation") ? detail : liste);
  }) as unknown as typeof fetch;
  return { session: new SessionPmmp(f, 0), urls };
}

/** La base de test est dédiée : on repart sans avis du portail pour des résultats déterministes. */
async function nettoyer() {
  await base.dossier.updateMany({ where: { avisId: { not: null } }, data: { avisId: null } });
  await base.avisAppelOffres.deleteMany({ where: { source: SOURCE_PMMP } });
  await base.collecteVeille.deleteMany({ where: { source: { in: [SOURCE_PMMP, SOURCE_RATTRAPAGE] } } });
}

describe.skipIf(!process.env.DATABASE_URL)("veille", () => {
  beforeAll(async () => {
    await nettoyer();
    A = (await base.tenant.create({ data: { nom: "Veille A" } })).id;
    B = (await base.tenant.create({ data: { nom: "Veille B" } })).id;
  });

  afterAll(async () => {
    await base.tenant.deleteMany({ where: { id: { in: [A, B] } } });
    await nettoyer();
    await base.$disconnect();
  });

  it("enregistre les avis de façon idempotente", async () => {
    const avis = lireListe(liste);
    expect(await enregistrerAvis(base, avis)).toEqual({ lus: 2, nouveaux: 2 });
    expect(await enregistrerAvis(base, avis)).toEqual({ lus: 2, nouveaux: 0 });
    const a = await base.avisAppelOffres.findUnique({
      where: { source_referenceSource: { source: SOURCE_PMMP, referenceSource: "o8p:1041301" } },
      include: { acheteur: true },
    });
    expect(a).toMatchObject({ typeMarche: "TRAVAUX", lieu: "SIDI KACEM", detailLe: null });
    expect(a?.acheteur?.nom).toMatch(/DIRECTEUR PROVINCIAL/);
  });

  it("collecte, complète les fiches, journalise et respecte l'intervalle minimal", async () => {
    const { session, urls } = portail();
    const j = await collecter(base, { declenchePar: "test", session, details: 5 });
    expect(j).toMatchObject({ statut: "ok", lus: 2, details: 2 });
    expect(urls.filter((u) => u.includes("EntrepriseDetailConsultation"))).toHaveLength(2);
    const a = await base.avisAppelOffres.findFirst({ where: { referenceSource: "o8p:1041301" } });
    expect(Number(a?.estimation)).toBe(21446884.14);
    expect(a?.detailLe).not.toBeNull();

    await expect(collecter(base, { declenchePar: "test", session: portail().session })).rejects.toBeInstanceOf(CollecteTropRapprochee);
  });

  it("s'arrête et journalise « interrompue » si le portail refuse", async () => {
    await base.collecteVeille.deleteMany({ where: { source: SOURCE_PMMP } });
    await expect(collecter(base, { declenchePar: "test", session: portail(403).session })).rejects.toThrow(/403/);
    expect(await base.collecteVeille.findFirst({ where: { source: SOURCE_PMMP } })).toMatchObject({ statut: "interrompue" });
  });

  it("rattrape les pages anciennes avec un curseur, s'arrête aux avis clos, attend 24 h après un cycle complet", async () => {
    const t0 = new Date("2026-09-26T10:00:00Z");
    const h = (n: number) => new Date(t0.getTime() + n * 3_600_000);
    const avis = lireListe(liste); // dates limites en novembre 2026 : ouverts à t0

    const o1 = await ouvrirRattrapage(base, t0);
    expect(o1).toMatchObject({ actif: true, pageDepart: 2 });
    if (!o1.actif) throw new Error();
    expect(await enregistrerPageRattrapage(base, { journalId: o1.journalId, page: 2, avis, derniere: false, maintenant: t0 })).toEqual({ continuer: true });
    expect(await enregistrerPageRattrapage(base, { journalId: o1.journalId, page: 3, avis, derniere: true, maintenant: t0 })).toEqual({ continuer: false });
    expect(await base.collecteVeille.findUnique({ where: { id: o1.journalId } })).toMatchObject({ statut: "ok", page: 3 });

    expect(await ouvrirRattrapage(base, h(0.5))).toMatchObject({ actif: false, raison: "rattrapage récent" });

    // Reprise après la page 3 ; une page sans avis ouvert clôt le cycle
    const o2 = await ouvrirRattrapage(base, h(2));
    expect(o2).toMatchObject({ actif: true, pageDepart: 4 });
    if (!o2.actif) throw new Error();
    const apresEcheance = new Date("2027-01-01T00:00:00Z");
    expect(await enregistrerPageRattrapage(base, { journalId: o2.journalId, page: 4, avis, derniere: false, maintenant: apresEcheance })).toEqual({
      continuer: false,
    });
    expect(await base.collecteVeille.findUnique({ where: { id: o2.journalId } })).toMatchObject({ statut: "complet" });
    await expect(enregistrerPageRattrapage(base, { journalId: o2.journalId, page: 5, avis, derniere: false })).rejects.toThrow(/clos/);

    // Cycle complet : pause de 24 h, puis nouveau cycle depuis la page 2
    await base.collecteVeille.update({ where: { id: o2.journalId }, data: { fin: h(2) } });
    expect(await ouvrirRattrapage(base, h(10))).toMatchObject({ actif: false, raison: "cycle complet depuis moins de 24 h" });
    const o3 = await ouvrirRattrapage(base, h(27));
    expect(o3).toMatchObject({ actif: true, pageDepart: 2 });
    if (!o3.actif) throw new Error();
    await interrompreRattrapage(base, o3.journalId, "Le portail a répondu 429");
    expect(await base.collecteVeille.findUnique({ where: { id: o3.journalId } })).toMatchObject({ statut: "interrompue" });
    // Une interruption ne fait pas perdre le curseur : reprise à la page suivant la dernière lue
    expect(await ouvrirRattrapage(base, h(29))).toMatchObject({ actif: true, pageDepart: 2 });
  });

  it("sélectionne les avis selon le profil de chaque cabinet, sans fuite entre cabinets", async () => {
    const dbA = tenantDb(base, A);
    const dbB = tenantDb(base, B);
    expect(await avisPertinents(base, dbA)).toEqual({ profil: false, avis: [] });

    await enregistrerProfilVeille({
      db: dbA,
      tenantId: A,
      userId: "u",
      alerteEmail: false,
      criteres: { motsCles: ["connectivite", "route"], exclusions: [], regions: [], typesMarche: ["TRAVAUX"], estimationMin: null, estimationMax: null },
    });
    await enregistrerProfilVeille({
      db: dbB,
      tenantId: B,
      userId: "u",
      alerteEmail: false,
      criteres: { motsCles: ["video"], exclusions: [], regions: ["Kenitra"], typesMarche: [], estimationMin: null, estimationMax: null },
    });

    const pourA = await avisPertinents(base, dbA);
    expect(pourA.avis.map((a) => a.objet.slice(0, 30))).toEqual(["Programme prioritaire de Conne"]);
    const pourB = await avisPertinents(base, dbB);
    expect(pourB.avis).toHaveLength(1);
    expect(pourB.avis[0].objet).toMatch(/vidéo protection/);

    // Suivre un avis crée un dossier à qualifier, une seule fois, visible du seul cabinet A
    const d1 = await suivreAvis({ prisma: base, db: dbA, tenantId: A, userId: "u", avisId: pourA.avis[0].id });
    const d2 = await suivreAvis({ prisma: base, db: dbA, tenantId: A, userId: "u", avisId: pourA.avis[0].id });
    expect(d2.id).toBe(d1.id);
    expect(d1).toMatchObject({ statut: "A_QUALIFIER", tenantId: A });
    expect((await avisPertinents(base, dbA)).avis[0].dossierId).toBe(d1.id);
    expect(await dbB.dossier.count()).toBe(0);
  });
});
