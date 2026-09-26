/**
 * Dates affichées à l'heure du Maroc, quel que soit le fuseau du serveur (les fonctions Netlify tournent en UTC).
 */
export const FUSEAU = "Africa/Casablanca";

export function dateFr(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { timeZone: FUSEAU });
}

export function dateHeureFr(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { timeZone: FUSEAU, dateStyle: "short", timeStyle: "short" });
}

export function heureFr(d: Date | string): string {
  return new Date(d).toLocaleTimeString("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" });
}
