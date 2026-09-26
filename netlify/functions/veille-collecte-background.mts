import { allerALaPage, CollecteInterrompue, listeTriee, SessionPmmp } from "../../lib/veille/pmmp";

/**
 * Collecte en arrière-plan (15 min max) :
 * 1. avis les plus récents et fiches détail, via les routes de l'application ;
 * 2. rattrapage des pages plus anciennes : lu ici (le portail est lent, ~15 s par page de 100 avis),
 *    chaque page analysée étant envoyée à /api/veille/rattrapage qui l'enregistre.
 * Toutes les routes exigent CRON_SECRET.
 */
export default async function veilleCollecte(req: Request) {
  const url = Netlify.env.get("URL");
  const secret = Netlify.env.get("CRON_SECRET");
  if (!url || !secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    console.error("[veille] appel refusé");
    return;
  }
  const appeler = async (chemin: string, corps?: unknown) => {
    const res = await fetch(`${url}${chemin}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const texte = await res.text();
    console.log(`[veille] ${chemin} → ${res.status} ${texte.slice(0, 200)}`);
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(texte);
    } catch {}
    return { ok: res.ok, json };
  };

  // 1. Avis récents puis fiches détail par lots
  const collecte = await appeler("/api/veille/collecte");
  if (collecte.ok) {
    for (let lot = 0; lot < 4; lot++) {
      const { ok, json } = await appeler("/api/veille/details");
      if (!ok || !json.details) break;
    }
  }

  // 2. Rattrapage des pages plus anciennes
  const ouverture = await appeler("/api/veille/rattrapage", { action: "ouvrir" });
  if (!ouverture.ok || !ouverture.json.actif) return;
  const journalId = String(ouverture.json.journalId);
  const pageDepart = Number(ouverture.json.pageDepart);
  const pagesMax = Number(ouverture.json.pagesMax);

  try {
    const session = new SessionPmmp();
    let { html } = await listeTriee(session, 100);
    for (let i = 0; i < pagesMax; i++) {
      const page = pageDepart + i;
      const resultat = await allerALaPage(session, html, page);
      html = resultat.html;
      const { ok, json } = await appeler("/api/veille/rattrapage", {
        action: "page",
        journalId,
        page,
        derniere: i === pagesMax - 1,
        avis: resultat.avis,
      });
      if (!ok || !json.continuer) return;
    }
  } catch (e) {
    const message = e instanceof CollecteInterrompue ? e.message : `Erreur : ${(e as Error).message}`;
    await appeler("/api/veille/rattrapage", { action: "interrompre", journalId, message });
  }
}
