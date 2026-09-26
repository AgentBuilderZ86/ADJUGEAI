import Anthropic from "@anthropic-ai/sdk";

/**
 * Point d'accès unique à l'API Claude (côté serveur uniquement).
 * Aucune donnée personnelle n'est envoyée au-delà du texte de l'AO et du profil de l'entreprise (loi 09-08).
 */

/** Modèle retenu par la spécification produit ; surchargeable par variable d'environnement. */
export const MODELE_CLAUDE = process.env.ADJUGE_MODELE_CLAUDE || "claude-sonnet-5";

/** Les fonctions Netlify synchrones sont coupées à 60 s : on garde une marge. */
const DELAI_MS = 55_000;

let client: Anthropic | null = null;

export class ClaudeNonConfigure extends Error {
  constructor() {
    super("La qualification assistée n'est pas encore activée (clé API Anthropic absente).");
  }
}

export function claude(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeNonConfigure();
  client ??= new Anthropic({ apiKey, timeout: DELAI_MS, maxRetries: 0 });
  return client;
}

export function claudeDisponible() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Traduit les erreurs de l'API en messages exploitables par l'utilisateur. */
export function messageErreurClaude(e: unknown): string {
  if (e instanceof ClaudeNonConfigure) return e.message;
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return "L'analyse a dépassé le délai autorisé. Essayez avec le seul CPS ou le règlement de consultation, plutôt que le dossier complet.";
  }
  if (e instanceof Anthropic.RateLimitError) return "Service d'analyse momentanément saturé. Réessayez dans une minute.";
  if (e instanceof Anthropic.AuthenticationError) return "Clé API Anthropic invalide : contactez l'administrateur.";
  if (e instanceof Anthropic.BadRequestError) return "Le document n'a pas pu être analysé (format ou taille). Essayez de coller le texte.";
  if (e instanceof Anthropic.APIError) return `Service d'analyse indisponible (erreur ${e.status ?? "réseau"}). Réessayez plus tard.`;
  return e instanceof Error ? e.message : "Erreur inattendue pendant l'analyse.";
}
