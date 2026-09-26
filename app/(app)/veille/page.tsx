import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BoutonActualiser, BoutonSuivre, FormulaireProfilVeille } from "@/components/veille/formulaires";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/session";
import { mad } from "@/lib/utils";
import { avisPertinents, criteresDuProfil, derniereCollecte } from "@/lib/veille/service";

export const metadata = { title: "Veille" };

const LIBELLES_TYPE: Record<string, string> = { TRAVAUX: "Travaux", FOURNITURES: "Fournitures", SERVICES: "Services", ETUDES: "Études" };

function joursRestants(d: Date | null) {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export default async function Veille() {
  const { db, user } = await requireTenant();
  const [profil, resultat, collecte, total] = await Promise.all([
    db.profilVeille.findFirst({ orderBy: { createdAt: "asc" } }),
    avisPertinents(prisma, db),
    derniereCollecte(prisma),
    prisma.avisAppelOffres.count({ where: { dateLimite: { gt: new Date() } } }),
  ]);
  const administrateur = user.role !== "MEMBRE";

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Veille</h1>
          <p className="mt-1 text-slate-600">
            Les appels d&apos;offres ouverts qui correspondent à votre profil, publiés sur le portail des marchés publics.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {total.toLocaleString("fr-FR")} avis ouverts suivis ·{" "}
            {collecte
              ? `dernière collecte le ${collecte.debut.toLocaleString("fr-FR")} (${collecte.statut === "ok" ? "réussie" : collecte.statut})`
              : "aucune collecte encore"}
          </p>
        </div>
        {administrateur && <BoutonActualiser />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="h-fit">
          <h2 className="mb-4 font-semibold">Profil de veille</h2>
          <FormulaireProfilVeille
            modifiable={administrateur}
            profil={profil ? { ...criteresDuProfil(profil), alerteEmail: profil.alerteEmail } : null}
          />
        </Card>

        <div className="min-w-0 space-y-3">
          {!resultat.profil ? (
            <Card className="text-sm text-slate-600">Renseignez votre profil pour voir les avis qui vous concernent.</Card>
          ) : resultat.avis.length === 0 ? (
            <Card className="text-sm text-slate-600">
              Aucun avis ouvert ne correspond pour l&apos;instant. Élargissez vos mots-clés ou vos régions, ou revenez après la prochaine collecte.
            </Card>
          ) : (
            <>
              <p className="text-sm text-slate-600">{resultat.avis.length} avis correspondants, les plus pertinents d&apos;abord.</p>
              {resultat.avis.map((a) => {
                const j = joursRestants(a.dateLimite);
                return (
                  <Card key={a.id} className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{a.objet}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {[a.acheteur, a.lieu].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {a.dossierId ? (
                        <Link href={`/qualifier/${a.dossierId}`} className="text-sm font-medium text-marque-700 underline">
                          Dossier suivi
                        </Link>
                      ) : (
                        <BoutonSuivre avisId={a.id} />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {a.typeMarche && <span className="rounded bg-slate-100 px-1.5 py-0.5">{LIBELLES_TYPE[a.typeMarche]}</span>}
                      {a.procedure && <span>{a.procedure}</span>}
                      <span>Estimation : {a.estimation ? mad(a.estimation) : "non lue"}</span>
                      {a.cautionProvisoire && <span>Caution : {mad(a.cautionProvisoire)}</span>}
                      {a.dateLimite && (
                        <span className={j !== null && j <= 7 ? "font-medium text-red-700" : ""}>
                          Remise des plis : {a.dateLimite.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          {j !== null && ` (J-${j})`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Source : Portail marocain des marchés publics (TGR)
                      {a.datePublication && `, publié le ${a.datePublication.toLocaleDateString("fr-FR")}`} ·{" "}
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">
                          voir l&apos;avis et le dossier de consultation
                        </a>
                      )}
                    </p>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
