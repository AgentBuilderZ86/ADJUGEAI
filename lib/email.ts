/**
 * E-mails transactionnels via l'API HTTP de Resend (pas de dépendance).
 * Sans RESEND_API_KEY ni ADJUGE_EMAIL_EXPEDITEUR, rien n'est envoyé : les appelants le savent via `configure`.
 */
export interface Email {
  a: string[];
  sujet: string;
  html: string;
  texte: string;
}

export type ResultatEnvoi = { envoye: true; id: string } | { envoye: false; raison: string };

export interface ConfigEmail {
  cle?: string;
  expediteur?: string;
  fetch?: typeof fetch;
}

export function configEmail(env: Record<string, string | undefined> = process.env): ConfigEmail {
  return { cle: env.RESEND_API_KEY || undefined, expediteur: env.ADJUGE_EMAIL_EXPEDITEUR || undefined };
}

export function emailConfigure(c: ConfigEmail = configEmail()) {
  return Boolean(c.cle && c.expediteur);
}

export async function envoyerEmail(email: Email, c: ConfigEmail = configEmail()): Promise<ResultatEnvoi> {
  if (!c.cle || !c.expediteur) return { envoye: false, raison: "e-mail non configuré" };
  if (email.a.length === 0) return { envoye: false, raison: "aucun destinataire" };
  const f = c.fetch ?? fetch;
  try {
    const res = await f("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${c.cle}`, "content-type": "application/json" },
      body: JSON.stringify({ from: c.expediteur, to: email.a, subject: email.sujet, html: email.html, text: email.texte }),
      signal: AbortSignal.timeout(15_000),
    });
    const corps = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !corps.id) return { envoye: false, raison: `Resend ${res.status} : ${corps.message ?? "réponse inattendue"}` };
    return { envoye: true, id: corps.id };
  } catch (e) {
    return { envoye: false, raison: `envoi impossible : ${(e as Error).message}` };
  }
}

export function echapperHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
