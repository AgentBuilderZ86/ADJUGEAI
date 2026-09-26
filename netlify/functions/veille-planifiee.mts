import type { Config } from "@netlify/functions";

/** Toutes les 2 heures : déclenche la collecte en arrière-plan (limite de 30 s ici, 15 min là-bas). */
export default async function veillePlanifiee() {
  const url = Netlify.env.get("URL");
  const secret = Netlify.env.get("CRON_SECRET");
  if (!url || !secret) {
    console.error("[veille] URL ou CRON_SECRET manquant");
    return;
  }
  const res = await fetch(`${url}/.netlify/functions/veille-collecte-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log("[veille] collecte déclenchée :", res.status);
}

export const config: Config = {
  schedule: "13 */2 * * *",
};
