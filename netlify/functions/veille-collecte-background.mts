/**
 * Collecte en arrière-plan : liste des avis récents, puis fiches détail par petits lots.
 * Le travail est fait par les routes de l'application (/api/veille/*), protégées par CRON_SECRET.
 */
export default async function veilleCollecte(req: Request) {
  const url = Netlify.env.get("URL");
  const secret = Netlify.env.get("CRON_SECRET");
  if (!url || !secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    console.error("[veille] appel refusé");
    return;
  }
  const appeler = async (chemin: string) => {
    const res = await fetch(`${url}${chemin}`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    const corps = await res.text();
    console.log(`[veille] ${chemin} → ${res.status} ${corps.slice(0, 300)}`);
    let json: { details?: number } = {};
    try {
      json = JSON.parse(corps);
    } catch {}
    return { ok: res.ok, json };
  };

  const collecte = await appeler("/api/veille/collecte");
  if (!collecte.ok) return; // intervalle non écoulé, portail indisponible ou refus : on n'insiste pas
  for (let lot = 0; lot < 4; lot++) {
    const { ok, json } = await appeler("/api/veille/details");
    if (!ok || !json.details) return;
  }
}
