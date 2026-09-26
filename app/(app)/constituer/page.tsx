import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BoutonRetirerPiece, FormulairePiece, JoindreFichier } from "@/components/constituer/formulaires";
import { BadgeEtat } from "@/components/constituer/badges";
import { TYPE_PAR_CLE } from "@/lib/constituer/catalogue";
import { coffreFort, dossiersEnConstitution } from "@/lib/constituer/service";
import { requireTenant } from "@/lib/session";
import { dateFr } from "@/lib/dates";

export const metadata = { title: "Constituer" };

export default async function Constituer() {
  const { db } = await requireTenant();
  const [pieces, dossiers] = await Promise.all([coffreFort(db), dossiersEnConstitution(db)]);
  const aTraiter = pieces.filter((p) => p.etat === "expiree" || p.etat === "a-renouveler").length;

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Constituer</h1>
        <p className="mt-1 text-slate-600">
          Vos pièces administratives et leurs échéances, et la liste des pièces de chaque dossier, rapprochée du coffre-fort.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dossiers en préparation</h2>
        {dossiers.length === 0 ? (
          <Card className="text-sm text-slate-600">
            Aucun dossier en GO ou en préparation. Qualifiez un AO dans{" "}
            <Link href="/qualifier" className="text-marque-700 underline">
              Qualifier
            </Link>{" "}
            : les dossiers retenus apparaissent ici.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {dossiers.map((d) => (
              <Link key={d.id} href={`/constituer/${d.id}`} className="block min-w-0">
                <Card className="h-full space-y-2 hover:border-marque-600">
                  <p className="line-clamp-2 font-medium leading-snug">{d.titre}</p>
                  <p className="text-sm text-slate-600">{[d.acheteur, d.dateLimite && `remise le ${dateFr(d.dateLimite)}`].filter(Boolean).join(" · ")}</p>
                  {d.total === 0 ? (
                    <p className="text-sm text-marque-700">Préparer la liste des pièces →</p>
                  ) : (
                    <>
                      <div className="h-2 rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={d.total} aria-valuenow={d.pretes} aria-label="Pièces prêtes">
                        <div className="h-2 rounded-full bg-marque-700" style={{ width: `${(d.pretes / d.total) * 100}%` }} />
                      </div>
                      <p className="text-xs text-slate-600">
                        {d.pretes} / {d.total} pièces prêtes
                        {d.bloquantes > 0 && <span className="font-medium text-red-700"> · {d.bloquantes} éliminatoire{d.bloquantes > 1 ? "s" : ""} à régler</span>}
                      </p>
                    </>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="h-fit">
          <h2 className="mb-4 font-semibold">Ajouter une pièce</h2>
          <FormulairePiece />
        </Card>
        <div className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold">
            Coffre-fort{" "}
            {aTraiter > 0 && <span className="text-sm font-normal text-red-700">· {aTraiter} pièce{aTraiter > 1 ? "s" : ""} à renouveler</span>}
          </h2>
          {pieces.length === 0 ? (
            <Card className="text-sm text-slate-600">
              Enregistrez vos attestations fiscale et CNSS, votre certificat modèle 9 et vos certificats de qualification : Adjugé
              vous signale celles qui expirent avant vos dates de dépôt.
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100 p-0">
              {pieces.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.libelle}</p>
                    <p className="text-xs text-slate-500">
                      {[
                        p.libelle !== TYPE_PAR_CLE.get(p.type)?.libelle && TYPE_PAR_CLE.get(p.type)?.libelle,
                        p.numero && `n° ${p.numero}`,
                        p.delivreLe && `délivrée le ${dateFr(p.delivreLe)}`,
                        p.echeance && `valable jusqu'au ${dateFr(p.echeance)}${p.expireLe ? "" : " (calculé)"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {p.fichier ? (
                        <a href={`/api/coffre/${p.id}`} target="_blank" rel="noopener" className="text-marque-700 underline">
                          {p.fichier.nom} ({Math.max(1, Math.round(p.fichier.taille / 1024)).toLocaleString("fr-FR")} Ko)
                        </a>
                      ) : (
                        <span className="text-slate-500">Aucun fichier</span>
                      )}
                      <JoindreFichier pieceId={p.id} remplacer={Boolean(p.fichier)} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <BadgeEtat etat={p.etat} />
                    <BoutonRetirerPiece pieceId={p.id} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
