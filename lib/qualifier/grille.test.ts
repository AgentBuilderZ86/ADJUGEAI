import { describe, expect, it } from "vitest";
import { appliquerGrille, BLOCS, verdictPourScore, type EvaluationBlocs } from "./grille";

const sansKill = { referencesEliminatoiresNonCouvertes: false, budgetInsuffisant: false, tropEditeur: false };
const notes = (n: number) => Object.fromEntries(BLOCS.map((b) => [b.cle, n])) as EvaluationBlocs["notes"];

describe("grille de qualification", () => {
  it("pondère les 6 blocs sur 100", () => {
    expect(BLOCS.reduce((s, b) => s + b.poids, 0)).toBe(100);
    expect(appliquerGrille({ notes: notes(10), killSwitches: sansKill }).scoreTotal).toBe(100);
    expect(appliquerGrille({ notes: notes(5), killSwitches: sansKill }).scoreTotal).toBe(50);
  });

  it("calcule les points par bloc", () => {
    const r = appliquerGrille({ notes: { ...notes(0), alignement: 8, risques: 5 }, killSwitches: sansKill });
    expect(r.scoreParBloc.alignement).toBe(16);
    expect(r.scoreParBloc.risques).toBe(5);
    expect(r.scoreTotal).toBe(21);
  });

  it.each([
    [75, "GO"],
    [74, "GO_CONDITIONNEL"],
    [60, "GO_CONDITIONNEL"],
    [59, "NO_GO_DEFAUT"],
    [40, "NO_GO_DEFAUT"],
    [39, "NO_GO"],
  ] as const)("seuil : %i → %s", (score, verdict) => {
    expect(verdictPourScore(score)).toBe(verdict);
  });

  it("références éliminatoires non couvertes → NO GO quel que soit le score", () => {
    const r = appliquerGrille({ notes: notes(10), killSwitches: { ...sansKill, referencesEliminatoiresNonCouvertes: true } });
    expect(r.verdict).toBe("NO_GO");
    expect(r.killSwitchesActifs).toEqual(["referencesEliminatoiresNonCouvertes"]);
  });

  it("budget insuffisant plafonne à 50, trop éditeur à 40, le plus strict l'emporte", () => {
    expect(appliquerGrille({ notes: notes(9), killSwitches: { ...sansKill, budgetInsuffisant: true } })).toMatchObject({
      scoreBrut: 90,
      scoreTotal: 50,
      verdict: "NO_GO_DEFAUT",
    });
    expect(
      appliquerGrille({ notes: notes(9), killSwitches: { ...sansKill, budgetInsuffisant: true, tropEditeur: true } }).scoreTotal,
    ).toBe(40);
  });

  it("ramène les notes hors bornes dans [0 ; 10]", () => {
    expect(appliquerGrille({ notes: notes(14), killSwitches: sansKill }).scoreTotal).toBe(100);
    expect(appliquerGrille({ notes: notes(-3), killSwitches: sansKill }).scoreTotal).toBe(0);
  });
});
