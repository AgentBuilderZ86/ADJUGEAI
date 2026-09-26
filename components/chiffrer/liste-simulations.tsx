"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { supprimerSim } from "@/app/(app)/chiffrer/actions";
import { mad, pct } from "@/lib/utils";
import { dateFr } from "@/lib/dates";

export interface LigneSimulation {
  id: string;
  date: string;
  type: string;
  estimation: number;
  prixRecommande: number | null;
  probabiliteGain: number | null;
  dossier: { id: string; titre: string } | null;
}

const LIBELLES: Record<string, string> = { TRAVAUX: "Travaux", FOURNITURES: "Fournitures", SERVICES: "Services", ETUDES: "Études" };

export function ListeSimulations({ simulations }: { simulations: LigneSimulation[] }) {
  if (simulations.length === 0) {
    return <Card className="text-sm text-slate-600">Aucune simulation enregistrée. Lancez une simulation puis enregistrez-la.</Card>;
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Dossier</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2 text-right">Estimation</th>
            <th className="px-4 py-2 text-right">Prix recommandé</th>
            <th className="px-4 py-2 text-right">P(gain)</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {simulations.map((s) => (
            <tr key={s.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2 whitespace-nowrap">{dateFr(s.date)}</td>
              <td className="px-4 py-2">
                {s.dossier ? (
                  <Link href={`/qualifier/${s.dossier.id}`} className="hover:text-marque-700">
                    {s.dossier.titre}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-2">{LIBELLES[s.type] ?? s.type}</td>
              <td className="px-4 py-2 text-right tabular-nums">{mad(s.estimation)}</td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">{s.prixRecommande === null ? "—" : mad(s.prixRecommande)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.probabiliteGain === null ? "—" : pct(s.probabiliteGain, 0)}</td>
              <td className="px-4 py-2 text-right">
                <BoutonSupprimer id={s.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function BoutonSupprimer({ id }: { id: string }) {
  const [etat, action, enCours] = useActionState(supprimerSim, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Supprimer cette simulation ?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="simulationId" value={id} />
      <button type="submit" disabled={enCours} className="text-xs text-red-700 hover:underline" title={etat?.erreur}>
        Supprimer
      </button>
    </form>
  );
}
