/**
 * Collecte des avis publiés sur le Portail marocain des marchés publics (PMMP, TGR).
 *
 * Cadre : ces avis sont publiés en exécution du décret n° 2-22-431 (art. 134) ; leur réutilisation
 * est permise par la loi 31-13 (art. 6) à des fins légitimes, sans altération, avec la source et la date.
 * Règles de conduite (docs/VEILLE.md) : identification honnête (jamais d'usurpation de navigateur),
 * faible débit, arrêt immédiat sur 403/429/503, aucune donnée personnelle conservée (contacts nominatifs
 * des fiches ignorés), aucun téléchargement de DCE.
 */

export const BASE_PMMP = "https://www.marchespublics.gov.ma/index.php";
export const AGENT = "AdjugeBot/1.0 (+https://adjugeai.netlify.app/robot)";
const PAUSE_MS = 2500;

export interface AvisBrut {
  refConsultation: string;
  orgAcronyme: string;
  reference: string;
  objet: string;
  procedure: string | null;
  categorie: string | null;
  datePublication: Date | null;
  dateLimite: Date | null;
  acheteur: string | null;
  lieu: string | null;
  url: string;
}

export interface DetailAvis {
  estimation: number | null;
  cautionProvisoire: number | null;
}

export class CollecteInterrompue extends Error {}

// ───────────────────────────── Lecture HTML ─────────────────────────────

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function texte(fragment: string): string {
  return fragment
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** « 20/11/2026 13:00 » ou « 20/09/2026 » → Date (heure de Casablanca, UTC+1). */
export function lireDate(s: string | undefined | null): Date | null {
  const m = s?.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, j, mo, a, h = "00", mi = "00"] = m;
  const d = new Date(`${a}-${mo}-${j}T${h}:${mi}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « 21 446 884,14 » → 21446884.14 */
export function lireMontantPmmp(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[\s  ]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cellule(ligne: string, entete: string): string {
  const m = ligne.match(new RegExp(`<td[^>]*headers="${entete}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}

/** Lignes de la liste de résultats (recherche avancée des consultations). */
export function lireListe(html: string): AvisBrut[] {
  const avis: AvisBrut[] = [];
  const lignes = html.split(/<tr[\s>]/).slice(1);
  for (const brut of lignes) {
    const ligne = brut.split("</tr>")[0];
    const ref = ligne.match(/_refCons" value="(\d+)"/)?.[1];
    const org = ligne.match(/_orgCons" value="([^"]+)"/)?.[1];
    if (!ref || !org) continue;

    const colRef = cellule(ligne, "cons_ref");
    const procedure = texte(ligne.match(/type_procedure">([\s\S]*?)<\/div>/)?.[1] ?? "") || null;
    const categorie = texte(ligne.match(/_panelBlocCategorie">([\s\S]*?)<\/div>/)?.[1] ?? "") || null;
    const datePublication = lireDate(colRef.match(/_panelBlocCategorie">[\s\S]*?<\/div>\s*<div>\s*([\d/]+)/)?.[1]);

    const reference = texte(ligne.match(/_reference" class="ref">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const blocObjet = ligne.match(/_panelBlocObjet"[^>]*>([\s\S]*?)<span/)?.[1] ?? "";
    const objet = texte(blocObjet).replace(/^Objet\s*:\s*/i, "");
    const acheteur = texte(ligne.match(/_panelBlocDenomination"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "").replace(/^Acheteur public\s*:\s*/i, "") || null;

    const lieux = texte(cellule(ligne, "cons_lieuExe")).split(/\s*(?:\.\.\.|-)\s*/).filter(Boolean);
    const dateLimite = lireDate(texte(cellule(ligne, "cons_dateEnd")));

    avis.push({
      refConsultation: ref,
      orgAcronyme: org,
      reference,
      objet,
      procedure,
      categorie,
      datePublication,
      dateLimite,
      acheteur,
      lieu: lieux[0] ?? null,
      url: `${BASE_PMMP}?page=entreprise.EntrepriseDetailConsultation&refConsultation=${ref}&orgAcronyme=${org}`,
    });
  }
  return avis;
}

/** Estimation et caution provisoire depuis la fiche détail (les contacts nominatifs sont ignorés). */
export function lireDetail(html: string): DetailAvis {
  const t = texte(html);
  const estimation = lireMontantPmmp(t.match(/Estimation \(en Dhs TTC\)\s*\*?\s*:\s*([\d\s .,]+)/i)?.[1]);
  const caution = lireMontantPmmp(t.match(/Caution provisoire\s*:\s*([\d\s .,]+)/i)?.[1]);
  return { estimation, cautionProvisoire: caution };
}

export function nombreResultats(html: string): number | null {
  const m = html.match(/nombreElement">\s*([\d\s]+)/);
  return m ? Number(m[1].replace(/\s/g, "")) : null;
}

/** Champs cachés du formulaire PRADO (état de page nécessaire aux actions de tri et de pagination). */
export function champsCaches(html: string): Record<string, string> {
  const champs: Record<string, string> = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const nom = m[0].match(/name="([^"]+)"/)?.[1];
    if (!nom || /\$tableauResultSearch\$ctl\d+\$/.test(nom)) continue; // pas les lignes de résultats
    champs[nom] = m[0].match(/value="([^"]*)"/)?.[1]?.replace(/&amp;/g, "&").replace(/&quot;/g, '"') ?? "";
  }
  return champs;
}

// ───────────────────────────── Session HTTP ─────────────────────────────

type Fetch = typeof fetch;

export class SessionPmmp {
  private cookies = new Map<string, string>();
  private derniere = 0;
  constructor(
    private readonly fetchImpl: Fetch = fetch,
    private readonly pauseMs = PAUSE_MS,
  ) {}

  private async requete(url: string, init: RequestInit = {}): Promise<string> {
    const attente = this.derniere + this.pauseMs - Date.now();
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    this.derniere = Date.now();
    const res = await this.fetchImpl(url, {
      ...init,
      redirect: "follow",
      headers: {
        "user-agent": AGENT,
        "accept-language": "fr",
        ...(this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        ...(init.headers ?? {}),
      },
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [paire] = c.split(";");
      const i = paire.indexOf("=");
      if (i > 0) this.cookies.set(paire.slice(0, i).trim(), paire.slice(i + 1).trim());
    }
    if ([403, 429, 503].includes(res.status)) {
      throw new CollecteInterrompue(`Le portail a répondu ${res.status} : collecte arrêtée par précaution.`);
    }
    if (!res.ok) throw new CollecteInterrompue(`Réponse inattendue du portail (${res.status}).`);
    return res.text();
  }

  get(page: string) {
    return this.requete(`${BASE_PMMP}?${page}`);
  }

  /** Action PRADO (« postback ») sur le formulaire de la page courante. */
  postback(page: string, html: string, cible: string, valeurs: Record<string, string> = {}) {
    const corps = new URLSearchParams({ ...champsCaches(html), PRADO_POSTBACK_TARGET: cible, PRADO_POSTBACK_PARAMETER: "", ...valeurs });
    return this.requete(`${BASE_PMMP}?${page}`, {
      method: "POST",
      body: corps,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  }
}

const PAGE_CONSULTATIONS = "page=entreprise.EntrepriseAdvancedSearch&AllCons";
const TAILLE_PAGE = "ctl0$CONTENU_PAGE$resultSearch$listePageSizeTop";
const TRI_PUBLICATION = "ctl0$CONTENU_PAGE$resultSearch$tableauResultSearch$ctl0$ctl5";

function plusRecentePublication(avis: AvisBrut[]) {
  return Math.max(0, ...avis.map((a) => a.datePublication?.getTime() ?? 0));
}

/**
 * Les consultations les plus récemment publiées : liste triée par date de publication décroissante,
 * `taille` résultats (10, 20, 50 ou 100). Trois à quatre requêtes au plus.
 */
export async function collecterRecents(session: SessionPmmp, taille: 10 | 20 | 50 | 100 = 100): Promise<AvisBrut[]> {
  let html = await session.get(PAGE_CONSULTATIONS);
  if (taille !== 10) html = await session.postback(PAGE_CONSULTATIONS, html, TAILLE_PAGE, { [TAILLE_PAGE]: String(taille) });

  // Tri « Publié le » : un premier clic peut trier par ordre croissant ; on garde l'ordre le plus récent.
  const avant = lireListe(html);
  html = await session.postback(PAGE_CONSULTATIONS, html, TRI_PUBLICATION, { [`${TRI_PUBLICATION}.x`]: "5", [`${TRI_PUBLICATION}.y`]: "5" });
  let liste = lireListe(html);
  const estDecroissant = (l: AvisBrut[]) => l.length < 2 || (l[0].datePublication?.getTime() ?? 0) >= (l[l.length - 1].datePublication?.getTime() ?? 0);
  if (!estDecroissant(liste)) {
    html = await session.postback(PAGE_CONSULTATIONS, html, TRI_PUBLICATION, { [`${TRI_PUBLICATION}.x`]: "5", [`${TRI_PUBLICATION}.y`]: "5" });
    liste = lireListe(html);
  }
  return plusRecentePublication(liste) >= plusRecentePublication(avant) ? liste : avant;
}

export async function collecterDetail(session: SessionPmmp, avis: Pick<AvisBrut, "refConsultation" | "orgAcronyme">) {
  const html = await session.get(`page=entreprise.EntrepriseDetailConsultation&refConsultation=${avis.refConsultation}&orgAcronyme=${avis.orgAcronyme}`);
  return lireDetail(html);
}
