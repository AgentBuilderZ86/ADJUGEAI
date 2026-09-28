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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Noms d'institutions qui contiennent « conseil » (Conseil provincial, Conseil de la région, CNDH…) :
 * retirés avant la recherche des mots-clés, sinon « conseil » ramène tous les achats de ces collectivités.
 */
const INSTITUTIONS =
  /\bconseils? (?:(?:de la |de l |du |des )?(?:province|provincial|prefecture|prefectoral|region|regional|commune|communal|municipal|arrondissement|ville)\w*|national\w*|superieur\w*|economique\w*|d arrondissement|de l ordre\w*|de la concurrence|de la ville|des droits|d administration|de surveillance|de gouvernance)/g;

export function sansInstitutions(texteNormalise: string) {
  return texteNormalise.replace(INSTITUTIONS, " ").replace(/\s+/g, " ").trim();
}

/** Racine grossière : retire le pluriel (« routes » → « route », « travaux » → « travau »). */
function racine(mot: string) {
  return mot.length > 3 ? mot.replace(/(s|x)$/, "") : mot;
}

/** Distance d'édition bornée : vrai si a et b diffèrent d'au plus une opération. */
function unEcartAuPlus(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let ecarts = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++ecarts > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return ecarts + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Un mot du profil correspond à un mot du texte : même racine, début de mot (« rehabilit » ⊂ « rehabilitation »),
 * ou une faute de frappe tolérée pour les mots de 6 lettres et plus (« intelectuelles » ≈ « intellectuelles »).
 */
function motCorrespond(motProfil: string, motTexte: string) {
  const p = racine(motProfil);
  const t = racine(motTexte);
  if (t.startsWith(p)) return true;
  if (p.length < 6) return false;
  // Mot entier ou début de mot, à une faute près
  return unEcartAuPlus(p, t) || unEcartAuPlus(p, t.slice(0, p.length)) || unEcartAuPlus(p, t.slice(0, p.length + 1));
}

function contient(texteNormalise: string, terme: string) {
  const mots = normaliser(terme).split(" ").filter(Boolean);
  if (!mots.length) return false;
  const texte = texteNormalise.split(" ");
  for (let i = 0; i + mots.length <= texte.length; i++) {
    if (mots.every((m, k) => motCorrespond(m, texte[i + k]))) return true;
  }
  return false;
}

/** Objet qui décrit une prestation intellectuelle (étude, assistance technique, audit…), noms d'institutions retirés. */
const MOTIFS_ETUDE = /\b(etudes?|assistance technique|conseil|audit|expertise|amo|assistance a (la )?maitrise d ouvrage)\b/;

export function objetEtude(objet: string) {
  return MOTIFS_ETUDE.test(sansInstitutions(normaliser(objet)));
}

/**
 * Filtre de type : les études sont des services (cocher « Services » les inclut), et une étude reste
 * une étude même quand le portail la range en travaux ou en fournitures (« Étude du schéma directeur… »).
 */
function typeAccepte(avis: AvisComparable, types: TypeMarche[]) {
  if (types.includes(avis.typeMarche!)) return true;
  if (avis.typeMarche === "ETUDES" && types.includes("SERVICES")) return true;
  return types.includes("ETUDES") && objetEtude(avis.objet);
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
  if (c.typesMarche.length && avis.typeMarche && !typeAccepte(avis, c.typesMarche)) return null;
  if (c.regions.length && avis.lieu) {
    const lieu = normaliser(avis.lieu);
    if (!c.regions.some((r) => contient(lieu, r))) return null;
  }
  if (avis.estimation !== null) {
    if (c.estimationMin !== null && avis.estimation < c.estimationMin) return null;
    if (c.estimationMax !== null && avis.estimation > c.estimationMax) return null;
  }
  if (!c.motsCles.length) return 0;
  const texteMetier = sansInstitutions(texte);
  const trouves = c.motsCles.filter((m) => contient(texteMetier, m)).length;
  return trouves > 0 ? trouves : null;
}

/** « Travaux » / « Fournitures » / « Services » (catégorie du portail) → type de marché. */
export function typeDepuisCategorie(categorie: string | null, objet = ""): TypeMarche | null {
  const c = normaliser(categorie ?? "");
  if (c.startsWith("travaux")) return "TRAVAUX";
  if (c.startsWith("fourniture")) return "FOURNITURES";
  if (c.startsWith("service")) return objetEtude(objet) ? "ETUDES" : "SERVICES";
  return null;
}

/** Saisie libre « a, b ; c » ou une valeur par ligne → liste propre, sans doublon. */
export function lireListeTermes(s: string): string[] {
  return [...new Set(s.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 50);
}
