import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { BoutonImprimer } from "@/components/bouton-imprimer";
import { BadgeEtat, BadgeStatut } from "@/components/constituer/badges";
import { BoutonPreparer, BoutonRetirerExigence, ChampsExigence, FormulaireExigence } from "@/components/constituer/formulaires";
import { ENVELOPPES } from "@/lib/constituer/catalogue";
import { listeDuDossier } from "@/lib/constituer/service";
import { requireTenant } from "@/lib/session";
import { dateFr, dateHeureFr } from "@/lib/dates";

export const metadata = { title: "Pièces du dossier" };

export default async function PiecesDossier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireTenant();
  const liste = await listeDuDossier(db, id);
  if (!liste) notFound();
  const { dossier, lignes, avancement, dateReference, dateReferenceConnue } = liste;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-4 text-sm">
          <Link href="/constituer" className="text-slate-600 hover:text-marque-700">
            ← Constituer
          </Link>
          <Link href={`/qualifier/${dossier.id}`} className="text-slate-600 hover:text-marque-700">
            Qualification du dossier
          </Link>
        </div>
        {lignes.length > 0 && <BoutonImprimer />}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{dossier.titre}</h1>
        <p className="mt-1 text-slate-600">
          {[dossier.acheteur, dateReferenceConnue && `remise des plis le ${dateHeureFr(dateReference)}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      {lignes.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-700">
            La liste reprend le socle du décret n° 2-22-431 (art. 28 à 31 : dossiers administratif et technique, offre financière) et
            les exigences propres au RC relevées lors de la qualification. Chaque pièce est rapprochée de votre coffre-fort.
          </p>
          <BoutonPreparer dossierId={dossier.id} />
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <p>
              <span className="text-2xl font-bold tabular-nums">
                {avancement.pretes} / {avancement.total}
              </span>{" "}
              <span className="text-slate-600">pièces prêtes</span>
            </p>
            {avancement.bloquantes > 0 ? (
              <p className="font-medium text-red-700">
                {avancement.bloquantes} pièce{avancement.bloquantes > 1 ? "s" : ""} éliminatoire{avancement.bloquantes > 1 ? "s" : ""} pas encore prête
                {avancement.bloquantes > 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-marque-800">Toutes les pièces éliminatoires sont prêtes.</p>
            )}
            <p className="text-xs text-slate-500">
              Validités évaluées {dateReferenceConnue ? `à la date limite de dépôt (${dateFr(dateReference)})` : "à ce jour (date limite inconnue)"}. Le
              décret apprécie celle des attestations fiscale et CNSS à la date de leur production au maître d&apos;ouvrage.
            </p>
          </Card>

          {ENVELOPPES.map((env) => {
            const items = lignes.filter((l) => l.enveloppe === env.cle);
            if (items.length === 0) return null;
            return (
              <Card key={env.cle} className="p-0">
                <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">{env.libelle}</h2>
                <ul className="divide-y divide-slate-100">
                  {items.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {l.libelle}
                          {l.eliminatoire && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-800">éliminatoire</span>}
                        </p>
                        <p className="text-xs text-slate-500">{l.reference}</p>
                        {l.piece && (
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            Coffre-fort : {l.piece.libelle}
                            {l.piece.echeance && `, valable jusqu'au ${dateFr(l.piece.echeance)}`}
                            <BadgeEtat etat={l.piece.etat} />
                          </p>
                        )}
                        {!l.piece && l.statut !== "PRETE" && l.reference?.includes("art. 28-I-A-2") && (
                          <p className="mt-1 text-xs text-slate-500">
                            Absente du coffre-fort —{" "}
                            <Link href="/constituer" className="underline">
                              l&apos;ajouter
                            </Link>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={l.piece ? "" : "hidden print:inline"}>
                          <BadgeStatut statut={l.statut} />
                        </span>
                        <div className="print:hidden">
                          <ChampsExigence id={l.id} statut={l.statutSaisi} responsable={l.responsable} verrouille={Boolean(l.piece)} />
                        </div>
                        <div className="print:hidden">
                          <BoutonRetirerExigence id={l.id} dossierId={dossier.id} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}

          <Card className="print:hidden">
            <h2 className="mb-3 font-semibold">Ajouter une pièce exigée par le RC</h2>
            <FormulaireExigence dossierId={dossier.id} />
          </Card>
          <p className="text-xs text-slate-500">
            Les exigences marquées « lu par l&apos;analyse » viennent de la lecture assistée par IA : vérifiez-les sur le RC original.
          </p>
        </>
      )}
    </div>
  );
}
