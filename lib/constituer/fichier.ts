/** Fichiers acceptés dans le coffre-fort : PDF et images, reconnus à leur signature et non à leur extension. */

export const TAILLE_MAX = 4 * 1024 * 1024; // sous la limite de 5 Mo des actions serveur et de 6 Mo des fonctions Netlify

const SIGNATURES: { type: string; ext: string; octets: number[] }[] = [
  { type: "application/pdf", ext: "pdf", octets: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { type: "image/png", ext: "png", octets: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/jpeg", ext: "jpg", octets: [0xff, 0xd8, 0xff] },
];

export class FichierRefuse extends Error {}

export function typeReconnu(octets: ArrayBuffer) {
  const v = new Uint8Array(octets.slice(0, 8));
  return SIGNATURES.find((s) => s.octets.every((o, i) => v[i] === o)) ?? null;
}

/** Nom affichable et sûr pour un en-tête Content-Disposition. */
export function nomSur(nom: string, ext: string) {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "piece"}.${ext}`;
}

export function verifierFichier(nom: string, octets: ArrayBuffer) {
  if (octets.byteLength === 0) throw new FichierRefuse("Le fichier est vide.");
  if (octets.byteLength > TAILLE_MAX) throw new FichierRefuse("Fichier trop volumineux : 4 Mo maximum.");
  const t = typeReconnu(octets);
  if (!t) throw new FichierRefuse("Format non accepté : PDF, PNG ou JPEG uniquement.");
  return { type: t.type, nom: nomSur(nom, t.ext), taille: octets.byteLength };
}
