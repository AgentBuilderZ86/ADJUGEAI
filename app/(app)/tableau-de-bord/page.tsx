import { LienBouton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MODULES } from "@/lib/modules";
import { requireTenant } from "@/lib/session";

export const metadata = { title: "Tableau de bord" };

export default async function TableauDeBord() {
  const { db, tenantId } = await requireTenant();
  const [tenant, dossiers, simulations] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.dossier.count(),
    db.simulationPrix.count(),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Bienvenue, {tenant?.nom}</h1>
        <p className="mt-1 text-slate-600">Votre espace est prêt. Qualifiez votre prochain appel d&apos;offres, puis chiffrez-le.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">AO suivis</p>
          <p className="mt-1 text-3xl font-bold">{dossiers}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Simulations de prix</p>
          <p className="mt-1 text-3xl font-bold">{simulations}</p>
        </Card>
        <Card className="flex flex-col justify-between">
          <p className="text-sm text-slate-600">Un nouvel AO ?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LienBouton href="/qualifier">Qualifier</LienBouton>
            <LienBouton href="/chiffrer" variante="secondaire">
              Chiffrer
            </LienBouton>
          </div>
        </Card>
      </div>
      <div>
        <h2 className="font-semibold">Feuille de route de votre espace</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODULES.map((m) => (
            <li key={m.cle} className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">V{m.vague}</span>
              <span>
                <span className="font-medium">{m.nom}</span> — <span className="text-slate-600">{m.promesse}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
