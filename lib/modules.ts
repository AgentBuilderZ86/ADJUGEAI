/** Les 8 modules du cycle complet, avec leur vague de livraison (voir docs/VISION.md). */
export const MODULES = [
  { cle: "veille", nom: "Veille", promesse: "Tous les AO utiles, filtrés sur votre métier, avec alertes.", vague: 1, disponibilite: "Vague 1" },
  { cle: "qualifier", nom: "Qualifier", promesse: "GO / NO GO argumenté en 5 minutes : grille à 6 blocs et critères éliminatoires.", vague: 1, disponibilite: "Disponible" },
  { cle: "chiffrer", nom: "Chiffrer", promesse: "Prix de référence probable et prix optimal à déposer, par simulation.", vague: 1, disponibilite: "Calculateur en ligne" },
  { cle: "constituer", nom: "Constituer", promesse: "Pièces exigées, attestations à renouveler, mémoire technique, conformité au RC.", vague: 2, disponibilite: "Vague 2" },
  { cle: "resultats", nom: "Résultats", promesse: "Historique des offres par acheteur et concurrent, post-mortem de chaque AO.", vague: 2, disponibilite: "Vague 2" },
  { cle: "executer", nom: "Exécuter", promesse: "Jalons, cautions, décomptes, pénalités et comités de pilotage.", vague: 3, disponibilite: "Vague 3" },
  { cle: "encaisser", nom: "Encaisser", promesse: "Suivi des paiements publics, intérêts moratoires, financement des créances.", vague: 3, disponibilite: "Vague 3" },
  { cle: "comptes", nom: "Comptes & groupements", promesse: "Plan de comptes, copilote IA, partenaires de groupement et sous-traitants.", vague: 4, disponibilite: "Vague 4" },
] as const;
