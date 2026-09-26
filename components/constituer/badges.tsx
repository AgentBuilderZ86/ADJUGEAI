import type { StatutPiece } from "@prisma/client";
import { LIBELLES_ETAT, type EtatValidite } from "@/lib/constituer/validite";
import { cn } from "@/lib/utils";

const COULEURS_ETAT: Record<EtatValidite, string> = {
  valide: "bg-marque-50 text-marque-800",
  "a-renouveler": "bg-amber-100 text-amber-900",
  expiree: "bg-red-100 text-red-800",
  "sans-echeance": "bg-slate-100 text-slate-700",
};

export function BadgeEtat({ etat }: { etat: EtatValidite }) {
  return <span className={cn("rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap", COULEURS_ETAT[etat])}>{LIBELLES_ETAT[etat]}</span>;
}

const STATUTS: Record<StatutPiece, { l: string; c: string }> = {
  MANQUANTE: { l: "Manquante", c: "bg-slate-100 text-slate-700" },
  EN_COURS: { l: "En cours", c: "bg-amber-100 text-amber-900" },
  PRETE: { l: "Prête", c: "bg-marque-50 text-marque-800" },
  EXPIREE: { l: "Expirée", c: "bg-red-100 text-red-800" },
};

export function BadgeStatut({ statut }: { statut: StatutPiece }) {
  return <span className={cn("rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUTS[statut].c)}>{STATUTS[statut].l}</span>;
}
