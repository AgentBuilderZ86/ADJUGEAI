import { bornes } from "./prix-reference";
import type { TypeMarche } from "./reglementation";

/**
 * Simulation Monte Carlo du prix à déposer (travaux, fournitures, services hors études).
 *
 * Pour chaque tirage, on génère les offres des concurrents selon un modèle de concurrence,
 * puis on évalue chaque prix candidat contre ce même tirage (nombres aléatoires communs),
 * en appliquant exactement les règles des art. 43 et 44 du décret 2-22-431.
 */

export type DistributionRatios =
  | { type: "normale"; moyenne: number; ecartType: number }
  | { type: "empirique"; ratios: number[] };

export interface ModeleConcurrence {
  /** Nombre de concurrents (hors nous), tiré uniformément entre min et max inclus. */
  nombreConcurrents: { min: number; max: number };
  /** Distribution du rapport offre / estimation des concurrents. */
  distribution: DistributionRatios;
}

/**
 * Hypothèse par défaut, à remplacer dès que l'historique est disponible (calibrer()).
 * Ce n'est pas une donnée observée : l'interface doit la présenter comme une hypothèse modifiable.
 */
export const MODELE_PAR_DEFAUT: ModeleConcurrence = {
  nombreConcurrents: { min: 4, max: 10 },
  distribution: { type: "normale", moyenne: 0.95, ecartType: 0.08 },
};

export interface PointSimulation {
  prix: number;
  /** Prix / estimation. */
  ratio: number;
  probabiliteGain: number;
  /** Probabilité que notre offre soit écartée (toujours 0 ou 1 : ne dépend que de l'estimation). */
  ecartee: boolean;
  /** Marge espérée = P(gain) × (prix − coût), si un coût de revient est fourni. */
  margeEsperee: number | null;
}

export interface ResultatSimulation {
  points: PointSimulation[];
  recommandation: PointSimulation | null;
  critere: "marge_esperee" | "probabilite_gain";
  iterations: number;
  /** Distribution simulée du prix de référence quand notre offre est au prix recommandé. */
  prixReferenceSimule: { p10: number; p50: number; p90: number } | null;
}

export interface ParametresSimulation {
  type: Exclude<TypeMarche, "etudes">;
  estimation: number;
  modele: ModeleConcurrence;
  /** Coût de revient (optionnel) pour optimiser la marge espérée plutôt que la seule probabilité. */
  cout?: number;
  /** Bornes de la grille en ratio de l'estimation (par défaut : bornes réglementaires). */
  grille?: { min: number; max: number; pas: number };
  iterations?: number;
  graine?: number;
}

export function simulerPrix(params: ParametresSimulation): ResultatSimulation {
  const { type, estimation, modele, cout } = params;
  if (!(estimation > 0)) throw new Error("L'estimation doit être strictement positive.");
  const { min: nMin, max: nMax } = modele.nombreConcurrents;
  if (nMin < 0 || nMax < nMin) throw new Error("Nombre de concurrents invalide.");
  if (modele.distribution.type === "empirique" && modele.distribution.ratios.length === 0) {
    throw new Error("La distribution empirique est vide.");
  }

  const iterations = params.iterations ?? 4000;
  const { seuilBas, seuilHaut } = bornes(type, estimation);
  const grille = params.grille ?? {
    min: Math.floor((seuilBas / estimation) * 100) / 100,
    max: Math.ceil((seuilHaut / estimation) * 100) / 100,
    pas: 0.005,
  };
  const candidats: number[] = [];
  for (let r = grille.min; r <= grille.max + 1e-9; r += grille.pas) candidats.push(Math.round(r * 10000) / 10000);

  const rng = mulberry32(params.graine ?? 42);
  const tirer = tireur(modele.distribution, rng);
  const gains = new Float64Array(candidats.length);
  const prixRefParCandidat: number[][] = candidats.map(() => []);

  for (let it = 0; it < iterations; it++) {
    const n = nMin + Math.floor(rng() * (nMax - nMin + 1));
    const retenus: number[] = [];
    for (let k = 0; k < n; k++) {
      const montant = tirer() * estimation;
      if (montant <= seuilHaut && montant >= seuilBas) retenus.push(montant);
    }
    const somme = retenus.reduce((s, x) => s + x, 0);

    for (let c = 0; c < candidats.length; c++) {
      const prix = candidats[c] * estimation;
      if (prix > seuilHaut + 1e-6 || prix < seuilBas - 1e-6) continue;
      const moyenne = (somme + prix) / (retenus.length + 1);
      const P = (estimation + moyenne) / 2;
      prixRefParCandidat[c].push(P);
      gains[c] += partDeGain(prix, P, retenus);
    }
  }

  const points: PointSimulation[] = candidats.map((ratio, c) => {
    const prix = ratio * estimation;
    const ecartee = prix > seuilHaut + 1e-6 || prix < seuilBas - 1e-6;
    const probabiliteGain = ecartee ? 0 : gains[c] / iterations;
    return {
      prix,
      ratio,
      probabiliteGain,
      ecartee,
      margeEsperee: cout !== undefined ? probabiliteGain * (prix - cout) : null,
    };
  });

  const critere = cout !== undefined ? "marge_esperee" : "probabilite_gain";
  let recommandation: PointSimulation | null = null;
  for (const p of points) {
    if (p.ecartee) continue;
    const valeur = critere === "marge_esperee" ? p.margeEsperee! : p.probabiliteGain;
    const meilleure = recommandation
      ? critere === "marge_esperee"
        ? recommandation.margeEsperee!
        : recommandation.probabiliteGain
      : -Infinity;
    // À valeur égale, on préfère le prix le plus élevé (meilleure marge à risque égal).
    if (valeur > meilleure + 1e-12 || (Math.abs(valeur - meilleure) <= 1e-12 && recommandation && p.prix > recommandation.prix)) {
      recommandation = p;
    }
  }
  if (recommandation && recommandation.probabiliteGain === 0) recommandation = null;

  let prixReferenceSimule: ResultatSimulation["prixReferenceSimule"] = null;
  if (recommandation) {
    const idx = points.indexOf(recommandation);
    const valeurs = [...prixRefParCandidat[idx]].sort((a, b) => a - b);
    prixReferenceSimule = { p10: quantile(valeurs, 0.1), p50: quantile(valeurs, 0.5), p90: quantile(valeurs, 0.9) };
  }

  return { points, recommandation, critere, iterations, prixReferenceSimule };
}

/**
 * Part de victoire de notre offre (1 si seule mieux-disante, 1/k si k ex æquo, 0 sinon),
 * sachant qu'elle est retenue et que P a été calculé en l'incluant.
 */
export function partDeGain(prix: number, P: number, concurrentsRetenus: number[]): number {
  const eps = 1e-6;
  let exAequo = 0;
  if (prix <= P + eps) {
    for (const x of concurrentsRetenus) {
      if (Math.abs(x - prix) <= eps) exAequo++;
      else if (x > prix && x <= P + eps) return 0; // un concurrent est plus proche de P par défaut
    }
    return 1 / (1 + exAequo);
  }
  for (const x of concurrentsRetenus) {
    if (x <= P + eps) return 0; // il existe une offre par défaut : elle l'emporte
    if (Math.abs(x - prix) <= eps) exAequo++;
    else if (x < prix) return 0; // un concurrent est plus proche de P par excès
  }
  return 1 / (1 + exAequo);
}

// ---------------------------------------------------------------------------
// Calibration sur l'historique (PV d'ouverture des plis)
// ---------------------------------------------------------------------------

export interface ResultatHistorique {
  estimation: number;
  /** Montants de toutes les offres financières lues en séance publique. */
  offres: number[];
}

export interface Calibration {
  echantillons: number;
  ratios: number[];
  moyenne: number;
  ecartType: number;
  concurrentsParAo: { min: number; max: number; moyenne: number };
}

export function calibrer(historique: ResultatHistorique[]): Calibration | null {
  const valides = historique.filter((h) => h.estimation > 0 && h.offres.length > 0);
  if (valides.length === 0) return null;
  const ratios = valides.flatMap((h) => h.offres.filter((o) => o > 0).map((o) => o / h.estimation));
  const moyenne = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const variance = ratios.reduce((s, r) => s + (r - moyenne) ** 2, 0) / Math.max(1, ratios.length - 1);
  const tailles = valides.map((h) => h.offres.length);
  return {
    echantillons: valides.length,
    ratios,
    moyenne,
    ecartType: Math.sqrt(variance),
    concurrentsParAo: {
      min: Math.min(...tailles),
      max: Math.max(...tailles),
      moyenne: tailles.reduce((s, t) => s + t, 0) / tailles.length,
    },
  };
}

/** Modèle de concurrence déduit d'une calibration (nous sommes un soumissionnaire de plus). */
export function modeleDepuisCalibration(c: Calibration): ModeleConcurrence {
  return {
    nombreConcurrents: {
      min: Math.max(0, c.concurrentsParAo.min - 1),
      max: Math.max(0, c.concurrentsParAo.max - 1),
    },
    distribution: { type: "empirique", ratios: c.ratios },
  };
}

// ---------------------------------------------------------------------------
// Outils aléatoires déterministes (reproductibilité des simulations)
// ---------------------------------------------------------------------------

export function mulberry32(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tireur(d: DistributionRatios, rng: () => number): () => number {
  if (d.type === "empirique") {
    const r = d.ratios;
    return () => r[Math.floor(rng() * r.length)];
  }
  return () => {
    // Box-Muller
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return d.moyenne + d.ecartType * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

function quantile(tries: number[], q: number): number {
  if (tries.length === 0) return NaN;
  const pos = (tries.length - 1) * q;
  const bas = Math.floor(pos);
  const haut = Math.ceil(pos);
  return tries[bas] + (tries[haut] - tries[bas]) * (pos - bas);
}
