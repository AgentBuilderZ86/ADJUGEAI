import { describe, expect, it } from "vitest";
import { classerParRapportA, evaluerOffres, evaluerOffresEtudes, statutOffre } from "./prix-reference";

describe("statutOffre — art. 44-B", () => {
  it("travaux : ±20 %, bornes incluses", () => {
    expect(statutOffre("travaux", 1000, 800)).toBe("retenue");
    expect(statutOffre("travaux", 1000, 799.99)).toBe("anormalement_basse");
    expect(statutOffre("travaux", 1000, 1200)).toBe("retenue");
    expect(statutOffre("travaux", 1000, 1200.01)).toBe("excessive");
  });

  it("fournitures et services : -25 % / +20 %", () => {
    for (const type of ["fournitures", "services"] as const) {
      expect(statutOffre(type, 1000, 750)).toBe("retenue");
      expect(statutOffre(type, 1000, 749)).toBe("anormalement_basse");
      expect(statutOffre(type, 1000, 780)).toBe("retenue");
      expect(statutOffre(type, 1000, 1201)).toBe("excessive");
    }
  });
});

describe("evaluerOffres — art. 43 et 44-A", () => {
  it("calcule P = (E + M) / 2 après écartement, et retient la plus proche par défaut", () => {
    // E = 1 000 000 ; A écartée (anormalement basse), F écartée (excessive)
    const r = evaluerOffres("travaux", 1_000_000, [
      { id: "A", montant: 700_000 },
      { id: "B", montant: 850_000 },
      { id: "C", montant: 920_000 },
      { id: "D", montant: 960_000 },
      { id: "E", montant: 1_050_000 },
      { id: "F", montant: 1_300_000 },
    ]);
    const statut = Object.fromEntries(r.offres.map((o) => [o.id, o.statut]));
    expect(statut).toMatchObject({ A: "anormalement_basse", F: "excessive", B: "retenue" });
    // M = (850 + 920 + 960 + 1050) / 4 = 945 000 ; P = (1 000 000 + 945 000) / 2 = 972 500
    expect(r.moyenneRetenues).toBe(945_000);
    expect(r.prixReference).toBe(972_500);
    expect(r.mieuxDisantes).toEqual(["D"]);
    const rang = Object.fromEntries(r.offres.map((o) => [o.id, o.rang]));
    // Par défaut d'abord (D, C, B), puis par excès (E)
    expect(rang).toMatchObject({ D: 1, C: 2, B: 3, E: 4, A: null, F: null });
  });

  it("sans offre inférieure à P, retient la plus proche par excès", () => {
    const r = evaluerOffres("travaux", 1000, [
      { id: "X", montant: 1100 },
      { id: "Y", montant: 1150 },
    ]);
    // M = 1125 ; P = 1062,5 : aucune offre ≤ P
    expect(r.prixReference).toBe(1062.5);
    expect(r.mieuxDisantes).toEqual(["X"]);
  });

  it("signale les ex æquo (tirage au sort, art. 43-II-2)", () => {
    const r = evaluerOffres("services", 1000, [
      { id: "X", montant: 900 },
      { id: "Y", montant: 900 },
      { id: "Z", montant: 1100 },
    ]);
    expect(r.mieuxDisantes.sort()).toEqual(["X", "Y"]);
  });

  it("déclare l'appel d'offres infructueux si toutes les offres sont écartées", () => {
    const r = evaluerOffres("travaux", 1000, [{ id: "X", montant: 500 }]);
    expect(r.infructueux).toBe(true);
    expect(r.prixReference).toBeNull();
  });

  it("refuse les marchés d'études (art. 144)", () => {
    expect(() => evaluerOffres("etudes", 1000, [])).toThrow(/144/);
  });

  it("classe une offre égale à P comme par défaut", () => {
    const g = classerParRapportA(100, [
      { id: "a", montant: 100 },
      { id: "b", montant: 99 },
      { id: "c", montant: 100.5 },
    ]);
    expect(g.map((x) => x.map((o) => o.id))).toEqual([["a"], ["b"], ["c"]]);
  });
});

describe("evaluerOffresEtudes — art. 144", () => {
  it("applique seuil technique, écartement, note financière inversement proportionnelle et pondération", () => {
    const r = evaluerOffresEtudes({
      estimation: 1000,
      ponderationFinanciere: 30,
      seuilTechnique: 70,
      offres: [
        { id: "A", montant: 800, noteTechnique: 80 },
        { id: "B", montant: 1000, noteTechnique: 95 },
        { id: "C", montant: 600, noteTechnique: 90 }, // anormalement basse (< 750)
        { id: "D", montant: 900, noteTechnique: 65 }, // sous le seuil technique
      ],
    });
    const o = Object.fromEntries(r.offres.map((x) => [x.id, x]));
    expect(o.C.statut).toBe("anormalement_basse");
    expect(o.D.statut).toBe("technique_insuffisante");
    expect(o.A.noteFinanciere).toBe(100);
    expect(o.B.noteFinanciere).toBe(80);
    // A : 80×0,7 + 100×0,3 = 86 ; B : 95×0,7 + 80×0,3 = 90,5
    expect(o.A.noteGlobale).toBeCloseTo(86);
    expect(o.B.noteGlobale).toBeCloseTo(90.5);
    expect(r.mieuxDisantes).toEqual(["B"]);
  });

  it("borne la pondération financière entre 10 et 40 points", () => {
    expect(() =>
      evaluerOffresEtudes({ estimation: 1000, ponderationFinanciere: 50, seuilTechnique: 70, offres: [] }),
    ).toThrow(/10 et 40/);
  });
});
