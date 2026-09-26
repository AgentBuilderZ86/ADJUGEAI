import { Calculateur, type ValeursInitiales } from "@/components/chiffrer/calculateur";

export const metadata = { title: "Chiffrer" };

const TYPES = new Set(["travaux", "fournitures", "services"]);

export default async function Chiffrer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const estimation = Number(sp.estimation);
  const initial: ValeursInitiales = {
    type: sp.type && TYPES.has(sp.type) ? (sp.type as ValeursInitiales["type"]) : undefined,
    estimation: Number.isFinite(estimation) && estimation > 0 ? estimation : undefined,
  };
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold">Chiffrer</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Simulez le prix à déposer ou analysez une séance d&apos;ouverture des plis.
        {initial.estimation ? " Estimation reprise de l'AO qualifié." : ""}
      </p>
      <Calculateur initial={initial} />
    </div>
  );
}
