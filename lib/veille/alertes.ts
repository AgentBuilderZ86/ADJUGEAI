import type { PrismaClient } from "@prisma/client";
import { echapperHtml, envoyerEmail, emailConfigure, type ConfigEmail, type Email } from "@/lib/email";
import { dateFr, dateHeureFr } from "@/lib/dates";
import { mad } from "@/lib/utils";
import { criteresDuProfil, filtrerPertinents, type AvisPertinent } from "./service";

/** Un récapitulatif ne remonte jamais plus loin (e-mail activé tardivement, envois en échec). */
export const FENETRE_MAX_HEURES = 36;
/** Avis détaillés par e-mail ; les suivants sont renvoyés vers l'application. */
export const AVIS_PAR_EMAIL = 15;

export function composerAlerte(params: { cabinet: string; avis: AvisPertinent[]; urlBase: string }): Omit<Email, "a"> {
  const { cabinet, avis, urlBase } = params;
  const montres = avis.slice(0, AVIS_PAR_EMAIL);
  const reste = avis.length - montres.length;
  const lienVeille = `${urlBase}/veille`;
  const sujet = avis.length === 1 ? "1 nouvel appel d'offres pour vous" : `${avis.length} nouveaux appels d'offres pour vous`;

  const details = (a: AvisPertinent) =>
    [
      [a.acheteur, a.lieu].filter(Boolean).join(" · "),
      [a.estimation ? `Estimation ${mad(a.estimation)}` : null, a.dateLimite ? `Remise des plis ${dateHeureFr(a.dateLimite)}` : null]
        .filter(Boolean)
        .join(" · "),
    ].filter(Boolean);

  const texte = [
    `Bonjour,`,
    ``,
    `${sujet} (${cabinet}), publiés sur le portail des marchés publics et correspondant à votre profil de veille :`,
    ``,
    ...montres.flatMap((a) => [`• ${a.objet}`, ...details(a).map((d) => `  ${d}`), ...(a.url ? [`  ${a.url}`] : []), ``]),
    ...(reste > 0 ? [`… et ${reste} autre${reste > 1 ? "s" : ""} dans l'application.`, ``] : []),
    `Tous vos avis : ${lienVeille}`,
    ``,
    `Pour ne plus recevoir ce récapitulatif, décochez l'alerte e-mail dans votre profil de veille.`,
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:640px">
<p>Bonjour,</p>
<p><strong>${echapperHtml(sujet)}</strong> (${echapperHtml(cabinet)}), publiés sur le portail des marchés publics et correspondant à votre profil de veille :</p>
${montres
  .map(
    (a) => `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:10px 0">
<p style="margin:0 0 4px;font-weight:bold">${echapperHtml(a.objet)}</p>
${details(a)
  .map((d) => `<p style="margin:0;font-size:13px;color:#475569">${echapperHtml(d)}</p>`)
  .join("\n")}
${a.url ? `<p style="margin:6px 0 0;font-size:13px"><a href="${echapperHtml(a.url)}">Voir l'avis sur le portail</a></p>` : ""}
</div>`,
  )
  .join("\n")}
${reste > 0 ? `<p>… et ${reste} autre${reste > 1 ? "s" : ""} dans l'application.</p>` : ""}
<p><a href="${echapperHtml(lienVeille)}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Ouvrir ma veille</a></p>
<p style="font-size:12px;color:#64748b">Pour ne plus recevoir ce récapitulatif, décochez l'alerte e-mail dans votre profil de veille. Source : Portail marocain des marchés publics (TGR).</p>
</div>`;

  return { sujet: `Adjugé — ${sujet}`, html, texte };
}

export interface BilanAlertes {
  profils: number;
  envoyes: number;
  sansNouveaute: number;
  echecs: { tenantId: string; raison: string }[];
  emailConfigure: boolean;
}

/**
 * Récapitulatif quotidien : pour chaque cabinet dont l'alerte est active, les avis ouverts collectés
 * depuis le dernier envoi, qui correspondent au profil et ne sont pas déjà suivis.
 * Tâche système : parcourt tous les cabinets, chaque requête filtre explicitement par tenantId.
 */
export async function envoyerAlertes(
  prisma: PrismaClient,
  options: { urlBase: string; maintenant?: Date; email?: ConfigEmail },
): Promise<BilanAlertes> {
  const maintenant = options.maintenant ?? new Date();
  const configure = emailConfigure(options.email);
  const bilan: BilanAlertes = { profils: 0, envoyes: 0, sansNouveaute: 0, echecs: [], emailConfigure: configure };
  const plancher = new Date(maintenant.getTime() - FENETRE_MAX_HEURES * 3_600_000);

  const profils = await prisma.profilVeille.findMany({ where: { alerteEmail: true }, include: { tenant: { select: { nom: true } } } });
  for (const profil of profils) {
    bilan.profils++;
    const reference = profil.derniereAlerte ?? profil.createdAt;
    const depuis = reference > plancher ? reference : plancher;

    const candidats = await prisma.avisAppelOffres.findMany({
      where: { createdAt: { gt: depuis, lte: maintenant }, dateLimite: { gt: maintenant }, dossiers: { none: { tenantId: profil.tenantId } } },
      orderBy: { datePublication: "desc" },
      take: 2000,
      include: { acheteur: { select: { nom: true } } },
    });
    const avis = filtrerPertinents(candidats, criteresDuProfil(profil));
    if (avis.length === 0) {
      bilan.sansNouveaute++;
      await prisma.profilVeille.update({ where: { id: profil.id }, data: { derniereAlerte: maintenant } });
      continue;
    }
    if (!configure) {
      bilan.echecs.push({ tenantId: profil.tenantId, raison: "e-mail non configuré" });
      continue;
    }

    const destinataires = (await prisma.user.findMany({ where: { tenantId: profil.tenantId }, select: { email: true } })).map((u) => u.email);
    const email = { ...composerAlerte({ cabinet: profil.tenant.nom, avis, urlBase: options.urlBase }), a: destinataires };
    const r = await envoyerEmail(email, options.email);
    if (!r.envoye) {
      bilan.echecs.push({ tenantId: profil.tenantId, raison: r.raison });
      continue;
    }
    bilan.envoyes++;
    await prisma.$transaction([
      prisma.profilVeille.update({ where: { id: profil.id }, data: { derniereAlerte: maintenant } }),
      prisma.auditLog.create({
        data: {
          tenantId: profil.tenantId,
          action: "veille.alerte",
          cible: `ProfilVeille:${profil.id}`,
          apres: { avis: avis.length, destinataires: destinataires.length, depuis: dateFr(depuis) },
        },
      }),
    ]);
  }
  return bilan;
}
