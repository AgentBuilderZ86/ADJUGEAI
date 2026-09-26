/**
 * Règles d'évaluation des offres financières — décret n° 2-22-431 du 8 mars 2023
 * relatif aux marchés publics (BO n° 7184 du 6 avril 2023, édition française).
 *
 * Source unique : texte officiel du décret. Chaque constante référence son article.
 * Voir docs/REGLEMENTATION.md pour les extraits et les points d'interprétation.
 */

export type TypeMarche = "travaux" | "fournitures" | "services" | "etudes";

export const TYPES_MARCHE: { valeur: TypeMarche; libelle: string }[] = [
  { valeur: "travaux", libelle: "Travaux" },
  { valeur: "fournitures", libelle: "Fournitures" },
  { valeur: "services", libelle: "Services (hors études)" },
  { valeur: "etudes", libelle: "Études (prestations intellectuelles)" },
];

export interface Seuils {
  /** Écart maximal sous l'estimation avant qualification d'offre anormalement basse. */
  bas: number;
  /** Écart maximal au-dessus de l'estimation avant qualification d'offre excessive. */
  haut: number;
}

/**
 * Art. 44-B (travaux, fournitures, services autres que les études)
 * et art. 144-2 (marchés d'études).
 */
export const SEUILS: Record<TypeMarche, Seuils> = {
  travaux: { bas: 0.2, haut: 0.2 },
  fournitures: { bas: 0.25, haut: 0.2 },
  services: { bas: 0.25, haut: 0.2 },
  etudes: { bas: 0.25, haut: 0.2 },
};

/** Art. 144-3 : la pondération de l'offre financière est comprise entre 10 et 40 points sur 100. */
export const PONDERATION_FINANCIERE_ETUDES = { min: 10, max: 40 };

/** Art. 147 : préférence nationale, minoration ou majoration de 15 %. */
export const PREFERENCE_NATIONALE = 0.15;

export const REFERENCES = {
  decret: "Décret n° 2-22-431 du 15 chaabane 1444 (8 mars 2023) relatif aux marchés publics",
  bulletinOfficiel: "BO n° 7184 du 15 ramadan 1444 (6 avril 2023)",
  articles: {
    evaluation: "Art. 43",
    prixReference: "Art. 44-A",
    seuils: "Art. 44-B",
    prixUnitaires: "Art. 44-C",
    etudes: "Art. 144",
    preferenceNationale: "Art. 147",
  },
} as const;
