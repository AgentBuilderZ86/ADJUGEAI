/**
 * Lecture tolérante des montants et des listes saisies ou collées depuis un PV
 * (formats marocains usuels : « 1 234 567,89 », « 1.234.567,89 », « 1234567.89 », « 1 234 567,89 DH »).
 */
export function lireMontant(brut: string): number | null {
  let s = brut.replace(/(mad|dhs?|dirhams?|ttc|ht)/gi, "").replace(/[\s  ']/g, "");
  if (!s) return null;
  const virgule = s.lastIndexOf(",");
  const point = s.lastIndexOf(".");
  if (virgule > -1 && point > -1) {
    // Le dernier séparateur est le séparateur décimal
    s = virgule > point ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (virgule > -1) {
    s = /,\d{3}$/.test(s) && s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (point > -1 && s.split(".").length > 2) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface LigneOffre {
  nom: string;
  montant: number;
  noteTechnique?: number;
}

/**
 * Une offre par ligne : « Nom ; montant » ou « Nom ; montant ; note technique ».
 * Séparateurs acceptés : point-virgule, tabulation (copier-coller Excel), barre verticale.
 * Une ligne ne contenant qu'un montant reçoit un nom générique.
 */
export function lireOffres(texte: string): { offres: LigneOffre[]; erreurs: string[] } {
  const offres: LigneOffre[] = [];
  const erreurs: string[] = [];
  texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((ligne, i) => {
      const cols = ligne.split(/[;\t|]/).map((c) => c.trim());
      const [nom, montantBrut, noteBrute] = cols.length === 1 ? [`Offre ${i + 1}`, cols[0], undefined] : cols;
      const montant = lireMontant(montantBrut ?? "");
      if (montant === null) {
        erreurs.push(`Ligne ${i + 1} : montant illisible (« ${ligne} »)`);
        return;
      }
      const note = noteBrute !== undefined ? Number(noteBrute.replace(",", ".")) : undefined;
      offres.push({ nom: nom || `Offre ${i + 1}`, montant, ...(note !== undefined && Number.isFinite(note) ? { noteTechnique: note } : {}) });
    });
  return { offres, erreurs };
}

/**
 * Historique pour la calibration : une ligne par AO passé,
 * « estimation ; offre 1 ; offre 2 ; … ».
 */
export function lireHistorique(texte: string): { lignes: { estimation: number; offres: number[] }[]; erreurs: string[] } {
  const lignes: { estimation: number; offres: number[] }[] = [];
  const erreurs: string[] = [];
  texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((ligne, i) => {
      const valeurs = ligne.split(/[;\t|]/).map((c) => lireMontant(c));
      if (valeurs.length < 2 || valeurs.some((v) => v === null)) {
        erreurs.push(`Ligne ${i + 1} : format attendu « estimation ; offre 1 ; offre 2 ; … »`);
        return;
      }
      const [estimation, ...offres] = valeurs as number[];
      lignes.push({ estimation, offres });
    });
  return { lignes, erreurs };
}
