import { TYPE_PAR_CLE } from "./catalogue";

/** Délai à partir duquel une pièce est signalée « à renouveler ». */
export const ALERTE_JOURS = 30;

export type EtatValidite = "valide" | "a-renouveler" | "expiree" | "sans-echeance";

export interface PieceDatee {
  type: string;
  delivreLe: Date | null;
  expireLe: Date | null;
}

function ajouterMois(d: Date, mois: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + mois);
  return r;
}

/** Échéance saisie, ou déduite de la délivrance quand le décret fixe une durée (attestations fiscale et CNSS). */
export function echeance(p: PieceDatee): Date | null {
  if (p.expireLe) return p.expireLe;
  const mois = TYPE_PAR_CLE.get(p.type)?.validiteMois;
  return p.delivreLe && mois ? ajouterMois(p.delivreLe, mois) : null;
}

/** État de la pièce à une date donnée (aujourd'hui, ou date de dépôt d'un dossier). */
export function etatA(p: PieceDatee, date: Date, alerteJours = ALERTE_JOURS): EtatValidite {
  const fin = echeance(p);
  if (!fin) return "sans-echeance";
  if (fin.getTime() <= date.getTime()) return "expiree";
  if (fin.getTime() - date.getTime() <= alerteJours * 86_400_000) return "a-renouveler";
  return "valide";
}

/** Parmi plusieurs pièces du même type, celle qui reste valable le plus longtemps. */
export function meilleurePiece<T extends PieceDatee>(pieces: T[]): T | null {
  let meilleure: T | null = null;
  for (const p of pieces) {
    if (!meilleure) {
      meilleure = p;
      continue;
    }
    const a = echeance(p)?.getTime() ?? Infinity;
    const b = echeance(meilleure)?.getTime() ?? Infinity;
    if (a > b) meilleure = p;
  }
  return meilleure;
}

export const LIBELLES_ETAT: Record<EtatValidite, string> = {
  valide: "Valide",
  "a-renouveler": "À renouveler",
  expiree: "Expirée",
  "sans-echeance": "Sans échéance",
};
