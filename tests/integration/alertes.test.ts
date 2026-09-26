import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { composerAlerte, envoyerAlertes } from "@/lib/veille/alertes";

const base = new PrismaClient();
const SOURCE = "test-alertes";
let A: string;
let B: string;
const maintenant = new Date("2030-03-10T07:00:00Z");
const envois: { to: string[]; subject: string; text: string }[] = [];
const email = {
  cle: "re_test",
  expediteur: "Adjugé <alertes@exemple.ma>",
  fetch: (async (_url: string, init: RequestInit) => {
    envois.push(JSON.parse(String(init.body)));
    return Response.json({ id: `em_${envois.length}` });
  }) as unknown as typeof fetch,
};

async function avis(ref: string, objet: string, creeIlYa: number) {
  return base.avisAppelOffres.create({
    data: {
      source: SOURCE,
      referenceSource: ref,
      objet,
      typeMarche: "TRAVAUX",
      dateLimite: new Date("2030-04-01T10:00:00Z"),
      createdAt: new Date(maintenant.getTime() - creeIlYa * 3_600_000),
    },
  });
}

describe.skipIf(!process.env.DATABASE_URL)("alertes de veille", () => {
  beforeAll(async () => {
    await base.avisAppelOffres.deleteMany({ where: { source: SOURCE } });
    A = (await base.tenant.create({ data: { nom: "Alertes A" } })).id;
    B = (await base.tenant.create({ data: { nom: "Alertes B" } })).id;
    await base.user.create({ data: { tenantId: A, email: "a1@alertes.test", nom: "A1", motDePasse: "x", role: "OWNER" } });
    await base.user.create({ data: { tenantId: A, email: "a2@alertes.test", nom: "A2", motDePasse: "x" } });
    await base.user.create({ data: { tenantId: B, email: "b1@alertes.test", nom: "B1", motDePasse: "x", role: "OWNER" } });
    const cree = new Date(maintenant.getTime() - 100 * 3_600_000);
    await base.profilVeille.create({ data: { tenantId: A, nom: "p", motsCles: ["voirie"], createdAt: cree } });
    await base.profilVeille.create({ data: { tenantId: B, nom: "p", motsCles: ["voirie"], alerteEmail: false, createdAt: cree } });
    await avis("r1", "Travaux de voirie à Kénitra", 5);
    await avis("r2", "Réhabilitation de voirie urbaine", 20);
    await avis("r3", "Achat de fournitures de bureau", 5); // hors profil
    await avis("r4", "Voirie ancienne", 60); // hors fenêtre de 36 h
    const suivi = await avis("r5", "Entretien de voirie déjà suivi", 5);
    await base.dossier.create({ data: { tenantId: A, titre: "suivi", avisId: suivi.id } });
  });

  afterAll(async () => {
    await base.tenant.deleteMany({ where: { id: { in: [A, B] } } });
    await base.avisAppelOffres.deleteMany({ where: { source: SOURCE } });
    await base.$disconnect();
  });

  it("sans fournisseur configuré, n'envoie rien et garde les avis pour plus tard", async () => {
    const bilan = await envoyerAlertes(base, { urlBase: "https://app.test", maintenant, email: {} });
    const mien = bilan.echecs.filter((e) => e.tenantId === A);
    expect(mien).toEqual([{ tenantId: A, raison: "e-mail non configuré" }]);
    expect((await base.profilVeille.findFirstOrThrow({ where: { tenantId: A } })).derniereAlerte).toBeNull();
  });

  it("envoie aux membres du cabinet les nouveaux avis pertinents non suivis, une seule fois", async () => {
    await envoyerAlertes(base, { urlBase: "https://app.test", maintenant, email });
    const pourA = envois.filter((e) => e.to.includes("a1@alertes.test"));
    expect(pourA).toHaveLength(1);
    expect(pourA[0].to.sort()).toEqual(["a1@alertes.test", "a2@alertes.test"]);
    expect(pourA[0].subject).toBe("Adjugé — 2 nouveaux appels d'offres pour vous");
    expect(pourA[0].text).toContain("Travaux de voirie à Kénitra");
    expect(pourA[0].text).not.toContain("fournitures de bureau");
    expect(pourA[0].text).not.toContain("déjà suivi");
    expect(pourA[0].text).not.toContain("Voirie ancienne");
    expect(envois.some((e) => e.to.includes("b1@alertes.test"))).toBe(false); // alerte désactivée
    expect(await base.auditLog.count({ where: { tenantId: A, action: "veille.alerte" } })).toBe(1);

    const n = envois.length;
    await envoyerAlertes(base, { urlBase: "https://app.test", maintenant: new Date(maintenant.getTime() + 60_000), email });
    expect(envois.filter((e) => e.to.includes("a1@alertes.test"))).toHaveLength(1);
    expect(envois.length).toBeGreaterThanOrEqual(n);
  });

  it("limite le détail et renvoie vers l'application", () => {
    const liste = Array.from({ length: 18 }, (_, i) => ({
      id: String(i), objet: `Avis <${i}>`, acheteur: null, lieu: null, typeMarche: null, procedure: null, estimation: null,
      cautionProvisoire: null, datePublication: null, dateLimite: null, url: null, score: 1, dossierId: null,
    }));
    const e = composerAlerte({ cabinet: "C & fils", avis: liste, urlBase: "https://app.test" });
    expect(e.texte).toContain("… et 3 autres dans l'application.");
    expect(e.html).toContain("Avis &lt;0&gt;");
    expect(e.html).toContain("C &amp; fils");
    expect(e.html).toContain("https://app.test/veille");
  });
});
