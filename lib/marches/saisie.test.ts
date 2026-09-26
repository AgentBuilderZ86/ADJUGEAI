import { describe, expect, it } from "vitest";
import { lireHistorique, lireMontant, lireOffres } from "./saisie";

describe("lireMontant", () => {
  it.each([
    ["1 234 567,89", 1234567.89],
    ["1.234.567,89", 1234567.89],
    ["1,234,567.89", 1234567.89],
    ["1234567.89", 1234567.89],
    ["1 234 567,89 DH", 1234567.89],
    ["980 000 MAD TTC", 980000],
    ["1.500.000", 1500000],
    ["750000", 750000],
    ["12,5", 12.5],
  ])("%s → %d", (brut, attendu) => {
    expect(lireMontant(brut)).toBeCloseTo(attendu, 2);
  });

  it("rejette les valeurs vides, nulles ou illisibles", () => {
    expect(lireMontant("")).toBeNull();
    expect(lireMontant("0")).toBeNull();
    expect(lireMontant("abc")).toBeNull();
  });
});

describe("lireOffres", () => {
  it("lit nom, montant et note, avec séparateurs variés", () => {
    const { offres, erreurs } = lireOffres("Société A ; 950 000,00\nSociété B\t1.020.000\n880000\nC | 900 000 | 82,5");
    expect(erreurs).toEqual([]);
    expect(offres).toEqual([
      { nom: "Société A", montant: 950000 },
      { nom: "Société B", montant: 1020000 },
      { nom: "Offre 3", montant: 880000 },
      { nom: "C", montant: 900000, noteTechnique: 82.5 },
    ]);
  });

  it("signale les lignes illisibles sans bloquer les autres", () => {
    const { offres, erreurs } = lireOffres("A ; 100\nB ; ???");
    expect(offres).toHaveLength(1);
    expect(erreurs[0]).toMatch(/Ligne 2/);
  });
});

describe("lireHistorique", () => {
  it("lit estimation puis offres", () => {
    const { lignes } = lireHistorique("1 000 000 ; 900 000 ; 950 000\n500000;480000");
    expect(lignes).toEqual([
      { estimation: 1000000, offres: [900000, 950000] },
      { estimation: 500000, offres: [480000] },
    ]);
  });
});
