import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionPmmp } from "@/lib/veille/pmmp";
import {
  avisPertinents,
  collecter,
  CollecteTropRapprochee,
  enregistrerAvis,
  enregistrerProfilVeille,
  SOURCE_PMMP,
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

async function nettoyer() {
  await base.avisAppelOffres.deleteMany({ where: { source: SOURCE_PMMP, referenceSource: { in: ["o8p:1041301", "g3h:963011"] } } });
  await base.collecteVeille.deleteMany({ where: { source: SOURCE_PMMP } });
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
