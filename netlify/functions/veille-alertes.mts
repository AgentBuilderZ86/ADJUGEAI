import type { Config } from "@netlify/functions";

/** Chaque matin (≈ 7 h 47 au Maroc) : récapitulatif e-mail des nouveaux avis pertinents. */
export default async function veilleAlertes() {
  const url = Netlify.env.get("URL");
  const secret = Netlify.env.get("CRON_SECRET");
  if (!url || !secret) {
    console.error("[alertes] URL ou CRON_SECRET manquant");
    return;
  }
  const res = await fetch(`${url}/api/veille/alertes`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  console.log("[alertes]", res.status, (await res.text()).slice(0, 500));
}

export const config: Config = {
  schedule: "47 6 * * *",
};
