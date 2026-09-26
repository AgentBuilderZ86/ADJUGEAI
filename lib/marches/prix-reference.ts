import { PONDERATION_FINANCIERE_ETUDES, SEUILS, type TypeMarche } from "./reglementation";

export interface Offre {
  id: string;
  montant: number;
}

export type StatutOffre = "retenue" | "excessive" | "anormalement_basse";

export interface OffreEvaluee extends Offre {
  statut: StatutOffre;
  /** Écart relatif à l'estimation du maître d'ouvrage (ex. -0,12 = 12 % sous l'estimation). */
  ecartEstimation: number;
  /** Écart relatif au prix de référence, pour les offres retenues. */
  ecartReference: number | null;
  rang: number | null;
}

export interface ResultatEvaluation {
  estimation: number;
  seuilBas: number;
  seuilHaut: number;
  /** Moyenne des offres retenues (M). */
  moyenneRetenues: number | null;
  /** Prix de référence P = (E + M) / 2 — art. 44-A. */
  prixReference: number | null;
  offres: OffreEvaluee[];
  /** Offre(s) la(les) mieux-disante(s). Plusieurs = égalité, départagée par tirage au sort (art. 43-II-2). */
  mieuxDisantes: string[];
  infructueux: boolean;
}

export function bornes(type: TypeMarche, estimation: number) {
  const s = SEUILS[type];
  return { seuilBas: estimation * (1 - s.bas), seuilHaut: estimation * (1 + s.haut) };
}

/**
 * Art. 44-B : « supérieure de plus de 20 % » / « inférieure de plus de 20 % (ou 25 %) ».
 * Une offre exactement égale à la borne n'est donc pas écartée.
 */
export function statutOffre(type: TypeMarche, estimation: number, montant: number): StatutOffre {
  const { seuilBas, seuilHaut } = bornes(type, estimation);
  if (montant > seuilHaut + EPSILON) return "excessive";
  if (montant < seuilBas - EPSILON) return "anormalement_basse";
  return "retenue";
}

const EPSILON = 1e-9;

/**
 * Évaluation des offres financières pour les marchés de travaux, de fournitures
 * et de services autres que les études (art. 43 et 44).
 *
 * 1. Écarter les offres excessives et anormalement basses par rapport à l'estimation.
 * 2. P = (E + moyenne des offres retenues) / 2.
 * 3. Mieux-disante = la plus proche de P par défaut ; à défaut, la plus proche par excès.
 */
export function evaluerOffres(type: TypeMarche, estimation: number, offres: Offre[]): ResultatEvaluation {
  if (type === "etudes") {
    throw new Error("Les marchés d'études relèvent de l'art. 144 : utiliser evaluerOffresEtudes().");
  }
  if (!(estimation > 0)) throw new Error("L'estimation du maître d'ouvrage doit être strictement positive.");

  const { seuilBas, seuilHaut } = bornes(type, estimation);
  const avecStatut = offres.map((o) => ({ ...o, statut: statutOffre(type, estimation, o.montant) }));
  const retenues = avecStatut.filter((o) => o.statut === "retenue");

  if (retenues.length === 0) {
    return {
      estimation,
      seuilBas,
      seuilHaut,
      moyenneRetenues: null,
      prixReference: null,
      offres: avecStatut.map((o) => ({ ...o, ecartEstimation: o.montant / estimation - 1, ecartReference: null, rang: null })),
      mieuxDisantes: [],
      infructueux: true,
    };
  }

  const moyenneRetenues = retenues.reduce((s, o) => s + o.montant, 0) / retenues.length;
  const prixReference = (estimation + moyenneRetenues) / 2;
  const classement = classerParRapportA(prixReference, retenues);

  const rangs = new Map<string, number>();
  classement.forEach((groupe, i) => groupe.forEach((o) => rangs.set(o.id, i + 1)));

  return {
    estimation,
    seuilBas,
    seuilHaut,
    moyenneRetenues,
    prixReference,
    offres: avecStatut.map((o) => ({
      ...o,
      ecartEstimation: o.montant / estimation - 1,
      ecartReference: o.statut === "retenue" ? o.montant / prixReference - 1 : null,
      rang: rangs.get(o.id) ?? null,
    })),
    mieuxDisantes: classement[0].map((o) => o.id),
    infructueux: false,
  };
}

/**
 * Classement des offres retenues au regard du prix de référence :
 * d'abord les offres ≤ P, de la plus proche à la plus éloignée,
 * puis les offres > P, de la plus proche à la plus éloignée.
 * Les montants identiques forment un même rang (ex æquo).
 *
 * Note d'interprétation : une offre exactement égale à P est traitée comme « par défaut ».
 */
export function classerParRapportA(prixReference: number, retenues: Offre[]): Offre[][] {
  const parDefaut = retenues.filter((o) => o.montant <= prixReference + EPSILON).sort((a, b) => b.montant - a.montant);
  const parExces = retenues.filter((o) => o.montant > prixReference + EPSILON).sort((a, b) => a.montant - b.montant);
  const groupes: Offre[][] = [];
  for (const o of [...parDefaut, ...parExces]) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && Math.abs(dernier[0].montant - o.montant) < EPSILON) dernier.push(o);
    else groupes.push([o]);
  }
  return groupes;
}

// ---------------------------------------------------------------------------
// Marchés d'études — art. 144
// ---------------------------------------------------------------------------

export interface OffreEtudes extends Offre {
  /** Note technique globale sur 100. */
  noteTechnique: number;
}

export interface OffreEtudesEvaluee extends OffreEtudes {
  statut: StatutOffre | "technique_insuffisante";
  noteFinanciere: number | null;
  noteGlobale: number | null;
  rang: number | null;
}

export interface ResultatEtudes {
  estimation: number;
  ponderationFinanciere: number;
  seuilTechnique: number;
  offres: OffreEtudesEvaluee[];
  mieuxDisantes: string[];
  infructueux: boolean;
}

/**
 * Art. 144 :
 * - écarter les offres dont la note technique est inférieure au seuil d'admissibilité (fixé au RC) ;
 * - écarter les offres excessives (> +20 %) et anormalement basses (< -25 %) ;
 * - note financière = 100 pour la moins-disante, inversement proportionnelle pour les autres
 *   (méthode par défaut — le RC peut en prévoir une autre) ;
 * - note globale = somme pondérée, pondération financière entre 10 et 40 points.
 */
export function evaluerOffresEtudes(params: {
  estimation: number;
  ponderationFinanciere: number;
  seuilTechnique: number;
  offres: OffreEtudes[];
}): ResultatEtudes {
  const { estimation, ponderationFinanciere, seuilTechnique, offres } = params;
  if (!(estimation > 0)) throw new Error("L'estimation du maître d'ouvrage doit être strictement positive.");
  const { min, max } = PONDERATION_FINANCIERE_ETUDES;
  if (ponderationFinanciere < min || ponderationFinanciere > max) {
    throw new Error(`La pondération financière doit être comprise entre ${min} et ${max} points (art. 144-3).`);
  }

  const evaluees: OffreEtudesEvaluee[] = offres.map((o) => {
    if (o.noteTechnique < seuilTechnique) {
      return { ...o, statut: "technique_insuffisante", noteFinanciere: null, noteGlobale: null, rang: null };
    }
    return { ...o, statut: statutOffre("etudes", estimation, o.montant), noteFinanciere: null, noteGlobale: null, rang: null };
  });

  const retenues = evaluees.filter((o) => o.statut === "retenue");
  if (retenues.length === 0) {
    return { estimation, ponderationFinanciere, seuilTechnique, offres: evaluees, mieuxDisantes: [], infructueux: true };
  }

  const moinsDisant = Math.min(...retenues.map((o) => o.montant));
  const w = ponderationFinanciere / 100;
  for (const o of retenues) {
    o.noteFinanciere = (100 * moinsDisant) / o.montant;
    o.noteGlobale = o.noteTechnique * (1 - w) + o.noteFinanciere * w;
  }

  const tri = [...retenues].sort((a, b) => b.noteGlobale! - a.noteGlobale!);
  let rang = 0;
  let precedente: number | null = null;
  tri.forEach((o, i) => {
    if (precedente === null || Math.abs(precedente - o.noteGlobale!) > EPSILON) rang = i + 1;
    o.rang = rang;
    precedente = o.noteGlobale!;
  });

  return {
    estimation,
    ponderationFinanciere,
    seuilTechnique,
    offres: evaluees,
    mieuxDisantes: tri.filter((o) => o.rang === 1).map((o) => o.id),
    infructueux: false,
  };
}
