import type { Verdict } from "@prisma/client";

/**
 * Grille de qualification GO / NO GO — 6 blocs pondérés sur 100, kill switches, seuils.
 * Le modèle d'IA évalue chaque bloc (note 0–10 justifiée) et signale les kill switches ;
 * le calcul du score et du verdict est fait ici, de façon déterministe et auditable.
 */

export const BLOCS = [
  {
    cle: "alignement",
    nom: "Alignement stratégique",
    poids: 20,
    question: "L'AO correspond-il au cœur de métier, aux secteurs et aux zones visés par l'entreprise ?",
  },
  {
    cle: "positionnement",
    nom: "Positionnement & rôle",
    poids: 15,
    question: "L'entreprise peut-elle se positionner seule ou en mandataire, avec une vraie différenciation ?",
  },
  {
    cle: "references",
    nom: "Références & attestations",
    poids: 20,
    question: "Les références, attestations et qualifications exigées sont-elles couvertes ?",
  },
  {
    cle: "competences",
    nom: "Compétences & staffing",
    poids: 15,
    question: "Les profils, moyens humains et matériels exigés sont-ils disponibles sur la période ?",
  },
  {
    cle: "economie",
    nom: "Économie & budget",
    poids: 20,
    question: "Le budget (estimation) permet-il une marge correcte au regard de l'effort, de la caution et des délais ?",
  },
  {
    cle: "risques",
    nom: "Risques contractuels",
    poids: 10,
    question: "Les pénalités, délais, garanties et clauses sont-ils acceptables ? (10 = risque faible)",
  },
] as const;

export type CleBloc = (typeof BLOCS)[number]["cle"];

export const KILL_SWITCHES = {
  referencesEliminatoiresNonCouvertes: {
    libelle: "Références éliminatoires non couvertes",
    effet: "NO GO automatique",
    plafond: 0,
  },
  budgetInsuffisant: {
    libelle: "Budget structurellement insuffisant",
    effet: "Score plafonné à 50",
    plafond: 50,
  },
  tropEditeur: {
    libelle: "AO « trop éditeur » (licences, SLA, maintenance d'un produit imposés)",
    effet: "Score plafonné à 40",
    plafond: 40,
  },
} as const;

export type CleKillSwitch = keyof typeof KILL_SWITCHES;

export const SEUILS_VERDICT = { go: 75, goConditionnel: 60, noGoDefaut: 40 } as const;

export const LIBELLES_VERDICT: Record<Verdict, string> = {
  GO: "GO",
  GO_CONDITIONNEL: "GO conditionnel",
  NO_GO_DEFAUT: "NO GO par défaut",
  NO_GO: "NO GO",
};

export interface EvaluationBlocs {
  notes: Record<CleBloc, number>;
  killSwitches: Record<CleKillSwitch, boolean>;
}

export interface ResultatGrille {
  scoreBrut: number;
  scoreTotal: number;
  scoreParBloc: Record<CleBloc, number>;
  killSwitchesActifs: CleKillSwitch[];
  verdict: Verdict;
}

export function verdictPourScore(score: number): Verdict {
  if (score >= SEUILS_VERDICT.go) return "GO";
  if (score >= SEUILS_VERDICT.goConditionnel) return "GO_CONDITIONNEL";
  if (score >= SEUILS_VERDICT.noGoDefaut) return "NO_GO_DEFAUT";
  return "NO_GO";
}

/** Applique pondérations, kill switches et seuils. Les notes hors [0 ; 10] sont ramenées dans l'intervalle. */
export function appliquerGrille(e: EvaluationBlocs): ResultatGrille {
  const scoreParBloc = {} as Record<CleBloc, number>;
  let scoreBrut = 0;
  for (const b of BLOCS) {
    const note = Math.min(10, Math.max(0, Number.isFinite(e.notes[b.cle]) ? e.notes[b.cle] : 0));
    const points = Math.round((note / 10) * b.poids * 10) / 10;
    scoreParBloc[b.cle] = points;
    scoreBrut += points;
  }
  scoreBrut = Math.round(scoreBrut);

  const killSwitchesActifs = (Object.keys(KILL_SWITCHES) as CleKillSwitch[]).filter((k) => e.killSwitches[k]);
  if (killSwitchesActifs.includes("referencesEliminatoiresNonCouvertes")) {
    return { scoreBrut, scoreTotal: scoreBrut, scoreParBloc, killSwitchesActifs, verdict: "NO_GO" };
  }
  const plafond = Math.min(100, ...killSwitchesActifs.map((k) => KILL_SWITCHES[k].plafond));
  const scoreTotal = Math.min(scoreBrut, plafond);
  return { scoreBrut, scoreTotal, scoreParBloc, killSwitchesActifs, verdict: verdictPourScore(scoreTotal) };
}
