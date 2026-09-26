import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BoutonSupprimerImport, FormulaireImport } from "@/components/chiffrer/import-historique";
import { historiqueDuCabinet, resumeHistorique } from "@/lib/chiffrer/service";
import { requireTenant } from "@/lib/session";
import { pct } from "@/lib/utils";
import { dateFr } from "@/lib/dates";

export const metadata = { title: "Historique de l'entreprise" };

const LIBELLES = { travaux: "Travaux", fournitures: "Fournitures", services: "Services" } as const;

export default async function Historique() {
  const { db } = await requireTenant();
  const [imports, lignes] = await Promise.all([
    db.historiqueImport.findMany({ orderBy: { createdAt: "desc" } }),
    historiqueDuCabinet(db),
  ]);
  const resume = resumeHistorique(lignes);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/chiffrer" className="text-sm text-slate-600 hover:text-marque-700">
          ← Chiffrer
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Historique de l&apos;entreprise</h1>
        <p className="mt-1 text-slate-600">
          Les résultats des AO auxquels vous avez répondu ou assisté calibrent vos simulations : comportement réel de vos concurrents, par type de
          marché. Ces données restent privées à votre entreprise.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.keys(LIBELLES) as (keyof typeof LIBELLES)[]).map((t) => (
          <Card key={t}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{LIBELLES[t]}</p>
            {resume[t] ? (
              <>
                <p className="mt-1 text-2xl font-bold">{resume[t]!.ao} AO</p>
                <p className="text-sm text-slate-600">
                  {resume[t]!.offres} offres · moyenne {pct(resume[t]!.moyenne)} de l&apos;estimation
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Aucune donnée</p>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Importer des résultats</h2>
        <FormulaireImport />
      </Card>

      {imports.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100 text-sm">
            {imports.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <span className="font-medium">{i.nom}</span>{" "}
                  <span className="text-slate-500">
                    · {Array.isArray(i.lignes) ? i.lignes.length : 0} AO · {dateFr(i.createdAt)}
                  </span>
                </span>
                <BoutonSupprimerImport id={i.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
