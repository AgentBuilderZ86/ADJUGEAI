import type { Palier } from "@prisma/client";

/** Paliers d'abonnement (prix indicatifs, à valider — docs/VISION.md). */
export const PALIERS: {
  cle: Palier;
  nom: string;
  prixMensuel: number | null;
  pour: string;
  inclus: string[];
  limites: { qualificationsParMois: number | null; simulationsParMois: number | null; utilisateurs: number | null };
}[] = [
  {
    cle: "GRATUIT",
    nom: "Découverte",
    prixMensuel: 0,
    pour: "Tester sur vos prochains AO",
    inclus: ["Calculateur du prix de référence", "3 qualifications par mois", "1 utilisateur"],
    limites: { qualificationsParMois: 3, simulationsParMois: 3, utilisateurs: 1 },
  },
  {
    cle: "ESSENTIEL",
    nom: "Essentiel",
    prixMensuel: 790,
    pour: "PME qui répondent régulièrement",
    inclus: ["Veille et alertes", "Qualification illimitée", "Résultats de base par acheteur", "3 utilisateurs"],
    limites: { qualificationsParMois: null, simulationsParMois: 5, utilisateurs: 3 },
  },
  {
    cle: "PRO",
    nom: "Pro",
    prixMensuel: 1990,
    pour: "Entreprises qui veulent gagner plus souvent",
    inclus: ["Tout Essentiel", "Chiffrage et simulation illimités", "Constitution du dossier", "Post-mortem", "10 utilisateurs"],
    limites: { qualificationsParMois: null, simulationsParMois: null, utilisateurs: 10 },
  },
  {
    cle: "ENTREPRISE",
    nom: "Entreprise",
    prixMensuel: 4900,
    pour: "Groupes, multi-entités, suivi d'exécution",
    inclus: ["Tout Pro", "Exécution, cautions et décomptes", "Encaissement et financement", "Comptes et groupements", "Utilisateurs illimités"],
    limites: { qualificationsParMois: null, simulationsParMois: null, utilisateurs: null },
  },
];
