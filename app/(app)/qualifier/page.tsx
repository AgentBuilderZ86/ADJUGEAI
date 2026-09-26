import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BadgeVerdict } from "@/components/qualifier/verdict";
import { FormulaireQualification } from "@/components/qualifier/formulaire-qualification";
import { claudeDisponible } from "@/lib/claude";
import { profilDepuis, profilRenseigne } from "@/lib/qualifier/profil";
import { quotaQualifications } from "@/lib/qualifier/service";
import { requireTenant } from "@/lib/session";
import { mad } from "@/lib/utils";

export const metadata = { title: "Qualifier" };

export default async function Qualifier({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db, tenantId } = await requireTenant();
  const aQualifier = sp.dossier ? await db.dossier.findUnique({ where: { id: sp.dossier } }) : null;
  const [tenant, quota, dossiers] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    quotaQualifications(db, tenantId),
    db.dossier.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { qualifications: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  const profilOk = profilRenseigne(profilDepuis(tenant?.profil));
  const desactive = !claudeDisponible()
    ? "La qualification assistée n'est pas encore activée sur cet environnement."
    : quota.restantes === 0
      ? `Quota atteint (${quota.limite} qualifications ce mois-ci). Passez à l'offre Essentiel pour un usage illimité.`
      : undefined;

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Qualifier</h1>
          <p className="mt-1 text-slate-600">GO / NO GO argumenté : grille à 6 blocs, critères éliminatoires, questions à poser à l&apos;acheteur.</p>
        </div>
        <p className="text-sm text-slate-600">
          {quota.limite === null ? "Qualifications illimitées" : `${quota.utilisees} / ${quota.limite} qualifications ce mois-ci`}
        </p>
      </div>

      {!profilOk && (
        <Card className="border-amber-300 bg-amber-50 text-sm">
          <p className="font-medium text-amber-900">Renseignez le profil de votre entreprise pour des verdicts pertinents.</p>
          <p className="mt-1 text-amber-900">
            Sans métiers ni références, l&apos;analyse reste prudente.{" "}
            <Link href="/qualifier/profil" className="font-medium underline">
              Compléter le profil
            </Link>
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <Card>
          {aQualifier ? (
            <div className="mb-4 space-y-2">
              <h2 className="font-semibold">Qualifier : {aQualifier.titre}</h2>
              <p className="text-sm text-slate-600">
                Joignez le règlement de consultation et le CPS de cet avis
                {aQualifier.sourceUrl && (
                  <>
                    {" "}
                    (à télécharger sur{" "}
                    <a href={aQualifier.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-marque-700 underline">
                      le portail des marchés publics
                    </a>
                    )
                  </>
                )}
                .
              </p>
            </div>
          ) : (
            <h2 className="mb-4 font-semibold">Nouvel appel d&apos;offres</h2>
          )}
          <FormulaireQualification desactive={desactive} dossierId={aQualifier?.id} />
        </Card>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">AO qualifiés</h2>
            <Link href="/qualifier/profil" className="text-sm text-marque-700 underline">
              Profil de l&apos;entreprise
            </Link>
          </div>
          {dossiers.length === 0 ? (
            <Card className="text-sm text-slate-600">Aucun AO qualifié pour l&apos;instant.</Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">AO</th>
                    <th className="px-4 py-2 text-right">Estimation</th>
                    <th className="px-4 py-2">Date limite</th>
                    <th className="px-4 py-2 text-right">Score</th>
                    <th className="px-4 py-2">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {dossiers.map((d) => {
                    const q = d.qualifications[0];
                    return (
                      <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link href={`/qualifier/${d.id}`} className="font-medium hover:text-marque-700">
                            {d.titre}
                          </Link>
                          {d.acheteur && <p className="text-xs text-slate-500">{d.acheteur}</p>}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{d.estimation ? mad(Number(d.estimation)) : "—"}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{d.dateDepot ? d.dateDepot.toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{q ? `${q.scoreTotal}/100` : "—"}</td>
                        <td className="px-4 py-2">
                          {q ? (
                            <BadgeVerdict verdict={q.verdict} />
                          ) : (
                            <Link href={`/qualifier?dossier=${d.id}`} className="text-xs font-medium text-marque-700 underline">
                              À qualifier
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
