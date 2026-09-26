/**
 * Pièces d'un dossier de réponse, d'après le décret n° 2-22-431 (art. 28 à 31).
 * Les durées de validité ne sont renseignées que lorsque le décret les fixe.
 */

export const REFERENCE_DECRET = "Décret n° 2-22-431";

export interface TypePiece {
  cle: string;
  libelle: string;
  /** Durée de validité fixée par le texte, en mois à compter de la délivrance */
  validiteMois?: number;
  source?: string;
  aide?: string;
}

export const TYPES_PIECE: TypePiece[] = [
  {
    cle: "ATTESTATION_FISCALE",
    libelle: "Attestation de régularité fiscale",
    validiteMois: 12,
    source: "art. 28-I-A-2-a",
    aide: "Délivrée depuis moins d'un an par le percepteur ; elle doit mentionner l'activité imposée. Validité appréciée à la date de production au maître d'ouvrage.",
  },
  {
    cle: "ATTESTATION_CNSS",
    libelle: "Attestation CNSS (ou organisme de prévoyance sociale)",
    validiteMois: 12,
    source: "art. 28-I-A-2-b",
    aide: "Délivrée depuis moins d'un an. Validité appréciée à la date de production au maître d'ouvrage.",
  },
  { cle: "REGISTRE_COMMERCE", libelle: "Certificat d'immatriculation au registre de commerce (modèle 9)", source: "art. 28-I-A-2-c" },
  { cle: "POUVOIRS", libelle: "Pouvoirs du signataire (statuts, PV, procuration, délégation)", source: "art. 28-I-A-1-a" },
  { cle: "CERTIFICAT_QUALIFICATION", libelle: "Certificat de qualification et de classification", source: "art. 28-I-B-3", aide: "Tient lieu de la note des moyens et des attestations de référence lorsqu'un système de qualification est prévu." },
  { cle: "AGREMENT", libelle: "Certificat d'agrément", source: "art. 28-I-B-4" },
  { cle: "AUTORISATION", libelle: "Attestation ou autorisation d'exercer l'activité", source: "art. 28-I-A-2-d" },
  { cle: "ATTESTATION_REFERENCE", libelle: "Attestation de référence (maître d'ouvrage)", source: "art. 28-I-B-2-b" },
  { cle: "CAPACITE_FINANCIERE", libelle: "Justificatif de capacité financière (bilans, attestation bancaire)", source: "art. 28-I-B-2-d" },
  { cle: "ASSURANCE", libelle: "Attestation d'assurance" },
  { cle: "AUTRE", libelle: "Autre pièce" },
];

export const TYPE_PAR_CLE = new Map(TYPES_PIECE.map((t) => [t.cle, t]));

export const ENVELOPPES = [
  { cle: "administratif", libelle: "Dossier administratif" },
  { cle: "technique", libelle: "Dossier technique" },
  { cle: "offre-technique", libelle: "Offre technique" },
  { cle: "financier", libelle: "Offre financière" },
  { cle: "autre", libelle: "Autres pièces" },
] as const;
export type CleEnveloppe = (typeof ENVELOPPES)[number]["cle"];

export interface ContexteDossier {
  /** Caution provisoire exigée (montant lu sur l'avis ou dans le RC) */
  caution: boolean;
  /** Offre technique exigée (études, notation technico-financière) */
  offreTechnique: boolean;
}

export interface ExigenceBase {
  enveloppe: CleEnveloppe;
  libelle: string;
  reference: string;
  typePiece?: string;
  eliminatoire?: boolean;
  si?: (c: ContexteDossier) => boolean;
}

/** Socle commun à tout appel d'offres ouvert ; complété par les exigences propres au RC. */
export const EXIGENCES_BASE: ExigenceBase[] = [
  { enveloppe: "administratif", libelle: "Pièces justifiant les pouvoirs du signataire", reference: "art. 28-I-A-1-a", typePiece: "POUVOIRS" },
  { enveloppe: "administratif", libelle: "Déclaration sur l'honneur (mentions de l'art. 29)", reference: "art. 28-I-A-1-b et 29" },
  {
    enveloppe: "administratif",
    libelle: "Récépissé du cautionnement provisoire ou attestation de caution personnelle et solidaire (original)",
    reference: "art. 28-I-A-1-c",
    eliminatoire: true,
    si: (c) => c.caution,
  },
  { enveloppe: "administratif", libelle: "Attestation de régularité fiscale (si attributaire pressenti)", reference: "art. 28-I-A-2-a", typePiece: "ATTESTATION_FISCALE" },
  { enveloppe: "administratif", libelle: "Attestation CNSS (si attributaire pressenti)", reference: "art. 28-I-A-2-b", typePiece: "ATTESTATION_CNSS" },
  { enveloppe: "administratif", libelle: "Certificat d'immatriculation au RC, modèle 9 (si attributaire pressenti)", reference: "art. 28-I-A-2-c", typePiece: "REGISTRE_COMMERCE" },
  { enveloppe: "administratif", libelle: "CPS et règlement de consultation paraphés et signés", reference: "art. 30" },
  { enveloppe: "technique", libelle: "Note des moyens humains et techniques et des prestations exécutées", reference: "art. 28-I-B-1-a" },
  { enveloppe: "offre-technique", libelle: "Offre technique (méthodologie, planning, équipe)", reference: "art. 31", eliminatoire: true, si: (c) => c.offreTechnique },
  { enveloppe: "financier", libelle: "Acte d'engagement signé, avec RIB, montant en chiffres et en lettres", reference: "art. 30-a", eliminatoire: true },
  { enveloppe: "financier", libelle: "Bordereau des prix et détail estimatif (ou bordereau du prix global et décomposition du montant global)", reference: "art. 30-b" },
];

export function exigencesDeBase(c: ContexteDossier) {
  return EXIGENCES_BASE.filter((e) => !e.si || e.si(c));
}
