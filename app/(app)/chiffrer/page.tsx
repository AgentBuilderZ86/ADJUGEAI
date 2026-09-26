import Link from "next/link";
import { Calculateur, type ValeursInitiales } from "@/components/chiffrer/calculateur";
import { ListeSimulations } from "@/components/chiffrer/liste-simulations";
import { historiqueDuCabinet, quotaSimulations } from "@/lib/chiffrer/service";
import { requireTenant } from "@/lib/session";

export const metadata = { title: "Chiffrer" };

const TYPES = new Set(["travaux", "fournitures", "services"]);

export default async function Chiffrer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db, tenantId } = await requireTenant();
  const [dossiers, historique, simulations, quota] = await Promise.all([
    db.dossier.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, titre: true } }),
    historiqueDuCabinet(db),
    db.simulationPrix.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { dossier: { select: { id: true, titre: true } } } }),
    quotaSimulations(db, tenantId),
  ]);

  const estimation = Number(sp.estimation);
  const initial: ValeursInitiales = {
    type: sp.type && TYPES.has(sp.type) ? (sp.type as ValeursInitiales["type"]) : undefined,
    estimation: Number.isFinite(estimation) && estimation > 0 ? estimation : undefined,
  };
  const dossierId = sp.dossier && dossiers.some((d) => d.id === sp.dossier) ? sp.dossier : undefined;

  return (
    <div className="max-w-6xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chiffrer</h1>
          <p className="mt-1 text-slate-600">
            Simulez le prix à déposer ou analysez une séance d&apos;ouverture des plis.
            {initial.estimation ? " Estimation reprise de l'AO qualifié." : ""}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 text-sm text-slate-600 sm:items-end">
          <p>{quota.limite === null ? "Enregistrements illimités" : `${quota.utilisees} / ${quota.limite} simulations enregistrées ce mois-ci`}</p>
          <Link href="/chiffrer/historique" className="text-marque-700 underline">
            Historique de l&apos;entreprise ({historique.length} AO)
          </Link>
        </div>
      </div>
      <Calculateur initial={initial} historiqueCabinet={historique} enregistrement={{ dossiers, dossierId }} />
      <section>
        <h2 className="mb-3 font-semibold">Simulations enregistrées</h2>
        <ListeSimulations
          simulations={simulations.map((s) => ({
            id: s.id,
            date: s.createdAt.toISOString(),
            type: s.typeMarche,
            estimation: Number(s.estimation),
            prixRecommande: s.prixRecommande === null ? null : Number(s.prixRecommande),
            probabiliteGain: s.probabiliteGain,
            dossier: s.dossier,
          }))}
        />
      </section>
    </div>
  );
}
