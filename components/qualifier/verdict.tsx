import type { Verdict } from "@prisma/client";
import { LIBELLES_VERDICT } from "@/lib/qualifier/grille";
import { cn } from "@/lib/utils";

const STYLES: Record<Verdict, { classe: string; icone: string }> = {
  GO: { classe: "bg-marque-100 text-marque-900 border-marque-600", icone: "✓" },
  GO_CONDITIONNEL: { classe: "bg-amber-50 text-amber-900 border-amber-500", icone: "!" },
  NO_GO_DEFAUT: { classe: "bg-orange-50 text-orange-900 border-orange-500", icone: "–" },
  NO_GO: { classe: "bg-red-50 text-red-900 border-red-600", icone: "✕" },
};

export function BadgeVerdict({ verdict, grand = false }: { verdict: Verdict; grand?: boolean }) {
  const s = STYLES[verdict];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border font-semibold whitespace-nowrap", s.classe, grand ? "px-3 py-1.5 text-lg" : "px-2 py-0.5 text-xs")}>
      <span aria-hidden>{s.icone}</span>
      {LIBELLES_VERDICT[verdict]}
    </span>
  );
}
