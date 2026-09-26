import type { TypeMarche } from "@prisma/client";

/** Critères d'un profil de veille (sans dépendance à la base). */
export interface CriteresVeille {
  motsCles: string[];
  exclusions: string[];
  regions: string[];
  typesMarche: TypeMarche[];
  estimationMin: number | null;
  estimationMax: number | null;
}

export interface AvisComparable {
  objet: string;
  acheteur: string | null;
  lieu: string | null;
  typeMarche: TypeMarche | null;
  estimation: number | null;
}

/** Minuscules, sans accents ni ponctuation : « Étude d'impact » → « etude d impact ». */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function contient(texteNormalise: string, terme: string) {
  const t = normaliser(terme);
  return t.length > 0 && ` ${texteNormalise} `.includes(` ${t}`);
}

/**
 * Pertinence d'un avis pour un profil : null si l'avis est exclu, sinon le nombre de mots-clés trouvés
 * (0 si le profil n'a pas de mot-clé : seuls les filtres s'appliquent).
 * - mots-clés : au moins un doit apparaître dans l'objet ou l'acheteur (début de mot) ;
 * - exclusions : aucun ne doit apparaître ;
 * - régions : l'une doit apparaître dans le lieu d'exécution (ignoré si le lieu est inconnu) ;
 * - types de marché et fourchette d'estimation : appliqués seulement si l'information est connue.
 */
export function pertinence(avis: AvisComparable, c: CriteresVeille): number | null {
  const texte = normaliser(`${avis.objet} ${avis.acheteur ?? ""}`);
  if (c.exclusions.some((e) => contient(texte, e))) return null;
  if (c.typesMarche.length && avis.typeMarche && !c.typesMarche.includes(avis.typeMarche)) return null;
  if (c.regions.length && avis.lieu) {
    const lieu = normaliser(avis.lieu);
    if (!c.regions.some((r) => contient(lieu, r))) return null;
  }
  if (avis.estimation !== null) {
    if (c.estimationMin !== null && avis.estimation < c.estimationMin) return null;
    if (c.estimationMax !== null && avis.estimation > c.estimationMax) return null;
  }
  if (!c.motsCles.length) return 0;
  const trouves = c.motsCles.filter((m) => contient(texte, m)).length;
  return trouves > 0 ? trouves : null;
}

/** « Travaux » / « Fournitures » / « Services » (catégorie du portail) → type de marché. */
export function typeDepuisCategorie(categorie: string | null, objet = ""): TypeMarche | null {
  const c = normaliser(categorie ?? "");
  if (c.startsWith("travaux")) return "TRAVAUX";
  if (c.startsWith("fourniture")) return "FOURNITURES";
  if (c.startsWith("service")) return /\b(etude|etudes|assistance technique|conseil|audit|expertise)\b/.test(normaliser(objet)) ? "ETUDES" : "SERVICES";
  return null;
}

/** Saisie libre « a, b ; c » ou une valeur par ligne → liste propre, sans doublon. */
export function lireListeTermes(s: string): string[] {
  return [...new Set(s.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 50);
}
