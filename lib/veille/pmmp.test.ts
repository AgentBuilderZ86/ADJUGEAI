import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { champsCaches, CollecteInterrompue, lireDate, lireDetail, lireListe, lireMontantPmmp, nombreResultats, SessionPmmp, AGENT } from "./pmmp";

const liste = readFileSync("tests/fixtures/pmmp-liste.html", "utf8");

describe("lecture de la liste du PMMP", () => {
  it("extrait les champs de chaque consultation", () => {
    const avis = lireListe(liste);
    expect(avis).toHaveLength(2);
    expect(avis[0]).toMatchObject({
      refConsultation: "1041301",
      orgAcronyme: "o8p",
      reference: "SK04/2026/CFR",
      procedure: "Appel d'offres ouvert",
      categorie: "Travaux",
      lieu: "SIDI KACEM",
    });
    expect(avis[0].objet).toMatch(/^Programme prioritaire de Connectivite Intercommunale/);
    expect(avis[0].acheteur).toMatch(/DIRECTEUR PROVINCIAL DE L'EQUIPEMENT/);
    expect(avis[0].dateLimite?.toISOString()).toBe("2026-11-20T12:00:00.000Z");
    expect(avis[0].url).toContain("refConsultation=1041301&orgAcronyme=o8p");
  });

  it("lit le nombre de résultats et les champs cachés PRADO (hors lignes)", () => {
    expect(nombreResultats(liste)).toBe(100295);
    const champs = champsCaches(liste);
    expect(champs.PRADO_PAGESTATE).toBe("etat&abc");
    expect(Object.keys(champs).some((k) => k.includes("tableauResultSearch$ctl1"))).toBe(false);
  });
});

describe("lecture de la fiche détail", () => {
  it("extrait estimation et caution, et rien d'autre", () => {
    expect(lireDetail(readFileSync("tests/fixtures/pmmp-detail.html", "utf8"))).toEqual({ estimation: 21446884.14, cautionProvisoire: 428000 });
  });
});

describe("formats", () => {
  it("dates et montants du portail", () => {
    expect(lireDate("20/11/2026 13:00")?.toISOString()).toBe("2026-11-20T12:00:00.000Z");
    expect(lireDate("n/a")).toBeNull();
    expect(lireMontantPmmp("1 234 567,89")).toBe(1234567.89);
    expect(lireMontantPmmp("")).toBeNull();
  });
});

describe("session", () => {
  it("s'identifie honnêtement, espace les requêtes et s'arrête sur 403", async () => {
    const appels: { ua: string | null; t: number }[] = [];
    const faux = (async (_url: string, init?: RequestInit) => {
      const t = Date.now(); // avant toute autre opération (la 1re construction de Headers est lente)
      appels.push({ ua: new Headers(init?.headers).get("user-agent"), t });
      return new Response("ok", { status: appels.length === 3 ? 403 : 200 });
    }) as typeof fetch;
    const s = new SessionPmmp(faux, 50);
    await s.get("page=a");
    await s.get("page=b");
    await expect(s.get("page=c")).rejects.toBeInstanceOf(CollecteInterrompue);
    expect(appels.every((a) => a.ua === AGENT)).toBe(true);
    expect(AGENT).not.toMatch(/Mozilla|Chrome|Safari/);
    expect(appels[1].t - appels[0].t).toBeGreaterThanOrEqual(45);
    expect(appels[2].t - appels[1].t).toBeGreaterThanOrEqual(45);
  });
});
