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

/**
 * Options du client. Une clé non rattachée à un espace de travail (workspace) de la console
 * Anthropic exige l'en-tête anthropic-workspace-id : il est ajouté si ANTHROPIC_WORKSPACE_ID est défini.
 */
export function optionsClient(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeNonConfigure();
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  return {
    apiKey,
    timeout: DELAI_MS,
    maxRetries: 0,
    ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
  };
}

export function claude(): Anthropic {
  client ??= new Anthropic(optionsClient());
  return client;
}

export function claudeDisponible() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Message d'erreur renvoyé par l'API (ne contient jamais la clé). */
function detailApi(e: InstanceType<typeof Anthropic.APIError>): string {
  const corps = e.error as { error?: { message?: string } } | undefined;
  return (corps?.error?.message ?? e.message ?? "").slice(0, 240);
}

/** Traduit les erreurs de l'API en messages exploitables par l'utilisateur. */
export function messageErreurClaude(e: unknown): string {
  if (e instanceof ClaudeNonConfigure) return e.message;
  if (e instanceof Anthropic.APIError && /anthropic-workspace-id/i.test(detailApi(e))) {
    return "Clé API Anthropic non rattachée à un espace de travail : renseignez ANTHROPIC_WORKSPACE_ID sur Netlify, ou créez une clé dans un workspace de la console Anthropic.";
  }
  if (e instanceof Anthropic.APIError && /credit balance/i.test(detailApi(e))) {
    return "Crédit API Anthropic insuffisant : rechargez le compte dans la console Anthropic (Plans & Billing), puis réessayez.";
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return "L'analyse a dépassé le délai autorisé. Essayez avec le seul CPS ou le règlement de consultation, plutôt que le dossier complet.";
  }
  if (e instanceof Anthropic.RateLimitError) return "Service d'analyse momentanément saturé. Réessayez dans une minute.";
  if (e instanceof Anthropic.AuthenticationError) return "Clé API Anthropic invalide : contactez l'administrateur.";
  if (e instanceof Anthropic.NotFoundError) return `Modèle d'analyse indisponible pour ce compte (${MODELE_CLAUDE}). Détail : ${detailApi(e)}`;
  if (e instanceof Anthropic.BadRequestError) return `Requête refusée par le service d'analyse. Détail : ${detailApi(e)}`;
  if (e instanceof Anthropic.APIError) return `Service d'analyse indisponible (erreur ${e.status ?? "réseau"}). Détail : ${detailApi(e)}`;
  return e instanceof Error ? e.message : "Erreur inattendue pendant l'analyse.";
}
