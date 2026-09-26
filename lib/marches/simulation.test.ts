import { describe, expect, it } from "vitest";
import { evaluerOffres } from "./prix-reference";
import { calibrer, modeleDepuisCalibration, mulberry32, partDeGain, simulerPrix, MODELE_PAR_DEFAUT } from "./simulation";

describe("partDeGain", () => {
  it("concorde avec evaluerOffres sur 5 000 cas aléatoires", () => {
    const rng = mulberry32(7);
    const E = 1_000_000;
    for (let i = 0; i < 5000; i++) {
      const n = Math.floor(rng() * 8);
      const concurrents = Array.from({ length: n }, () => Math.round((0.75 + rng() * 0.5) * E));
      const nous = Math.round((0.8 + rng() * 0.4) * E);
      const r = evaluerOffres("travaux", E, [
        { id: "nous", montant: nous },
        ...concurrents.map((m, k) => ({ id: `c${k}`, montant: m })),
      ]);
      const attendu = r.mieuxDisantes.includes("nous") ? 1 / r.mieuxDisantes.length : 0;
      const retenus = concurrents.filter((m) => m >= 0.8 * E && m <= 1.2 * E);
      const P = (E + (retenus.reduce((s, x) => s + x, 0) + nous) / (retenus.length + 1)) / 2;
      expect(partDeGain(nous, P, retenus)).toBeCloseTo(attendu, 9);
    }
  });
});

describe("simulerPrix", () => {
  it("est déterministe pour une graine donnée", () => {
    const p = { type: "travaux" as const, estimation: 1_000_000, modele: MODELE_PAR_DEFAUT, iterations: 500, graine: 3 };
    expect(simulerPrix(p).recommandation).toEqual(simulerPrix(p).recommandation);
  });

  it("n'accorde aucune chance à une offre hors bornes réglementaires", () => {
    const r = simulerPrix({
      type: "travaux",
      estimation: 1000,
      modele: MODELE_PAR_DEFAUT,
      grille: { min: 0.7, max: 1.3, pas: 0.05 },
      iterations: 300,
    });
    for (const p of r.points) {
      if (p.ratio < 0.8 || p.ratio > 1.2) {
        expect(p.ecartee).toBe(true);
        expect(p.probabiliteGain).toBe(0);
      }
    }
  });

  it("gagne à coup sûr sans concurrent, quel que soit le prix retenu", () => {
    const r = simulerPrix({
      type: "fournitures",
      estimation: 1000,
      modele: { nombreConcurrents: { min: 0, max: 0 }, distribution: { type: "normale", moyenne: 1, ecartType: 0.1 } },
      iterations: 50,
    });
    expect(r.points.filter((p) => !p.ecartee).every((p) => p.probabiliteGain === 1)).toBe(true);
    // À probabilité égale, le prix le plus élevé est recommandé
    expect(r.recommandation?.ratio).toBeCloseTo(1.2);
  });

  it("optimise la marge espérée quand un coût est fourni", () => {
    const r = simulerPrix({
      type: "travaux",
      estimation: 1_000_000,
      modele: MODELE_PAR_DEFAUT,
      cout: 850_000,
      iterations: 1500,
    });
    expect(r.critere).toBe("marge_esperee");
    const meilleure = Math.max(...r.points.map((p) => p.margeEsperee ?? -Infinity));
    expect(r.recommandation?.margeEsperee).toBe(meilleure);
    expect(r.prixReferenceSimule!.p10).toBeLessThanOrEqual(r.prixReferenceSimule!.p90);
  });

  it("vise juste sous le prix de référence face à des concurrents groupés", () => {
    // 5 concurrents à 0,90 × E. Notre offre x gagne tant que x ≤ P = (1 + (4,5 + x) / 6) / 2,
    // soit x ≤ 21/22 ≈ 0,9545 : le meilleur prix de la grille est 0,95.
    const r = simulerPrix({
      type: "travaux",
      estimation: 1000,
      modele: { nombreConcurrents: { min: 5, max: 5 }, distribution: { type: "empirique", ratios: [0.9] } },
      iterations: 20,
    });
    const reco = r.recommandation!;
    expect(reco.ratio).toBeCloseTo(0.95);
    expect(r.points.find((p) => Math.abs(p.ratio - 0.96) < 1e-9)!.probabiliteGain).toBe(0);
    expect(reco.probabiliteGain).toBe(1);
  });
});

describe("calibrer", () => {
  it("déduit ratios et nombre de concurrents de l'historique", () => {
    const c = calibrer([
      { estimation: 100, offres: [90, 95, 110] },
      { estimation: 200, offres: [180, 190] },
    ])!;
    expect(c.echantillons).toBe(2);
    expect(c.ratios).toEqual([0.9, 0.95, 1.1, 0.9, 0.95]);
    expect(c.concurrentsParAo).toMatchObject({ min: 2, max: 3 });
    expect(modeleDepuisCalibration(c).nombreConcurrents).toEqual({ min: 1, max: 2 });
  });

  it("renvoie null sans historique exploitable", () => {
    expect(calibrer([])).toBeNull();
  });
});
