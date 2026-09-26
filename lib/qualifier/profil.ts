import { z } from "zod";

/** Profil de l'entreprise utilisé pour qualifier les AO (stocké sur le Tenant). */
export const schemaProfil = z.object({
  metiers: z.string().trim().default(""),
  secteurs: z.string().trim().default(""),
  zones: z.string().trim().default(""),
  references: z.string().trim().default(""),
  moyens: z.string().trim().default(""),
  chiffreAffaires: z.string().trim().default(""),
  certifications: z.string().trim().default(""),
  horsPerimetre: z.string().trim().default(""),
});

export type ProfilEntreprise = z.infer<typeof schemaProfil>;

export const CHAMPS_PROFIL: { cle: keyof ProfilEntreprise; libelle: string; aide: string; lignes: number }[] = [
  { cle: "metiers", libelle: "Métiers et prestations", aide: "Ce que vous savez faire et vendez.", lignes: 3 },
  { cle: "secteurs", libelle: "Secteurs et acheteurs ciblés", aide: "Ministères, collectivités, établissements publics…", lignes: 2 },
  { cle: "zones", libelle: "Zones d'intervention", aide: "Régions, villes, national, international.", lignes: 1 },
  { cle: "references", libelle: "Références significatives", aide: "Une par ligne : objet, acheteur, montant, année, attestation disponible ou non.", lignes: 6 },
  { cle: "moyens", libelle: "Moyens humains et matériels", aide: "Effectif, profils clés, équipements.", lignes: 3 },
  { cle: "chiffreAffaires", libelle: "Chiffre d'affaires", aide: "Des 3 derniers exercices, si pertinent pour les seuils.", lignes: 1 },
  { cle: "certifications", libelle: "Qualifications, agréments, certifications", aide: "Qualification-classification, ISO, agréments ministériels…", lignes: 2 },
  { cle: "horsPerimetre", libelle: "Ce que vous ne faites pas", aide: "Activités exclues, montants minimaux, clauses refusées.", lignes: 2 },
];

export function profilDepuis(json: unknown): ProfilEntreprise {
  const r = schemaProfil.safeParse(json ?? {});
  return r.success ? r.data : schemaProfil.parse({});
}

export function profilRenseigne(p: ProfilEntreprise) {
  return Boolean(p.metiers || p.references);
}

export function profilEnTexte(p: ProfilEntreprise): string {
  return CHAMPS_PROFIL.map((c) => `- ${c.libelle} : ${p[c.cle] || "(non renseigné)"}`).join("\n");
}
