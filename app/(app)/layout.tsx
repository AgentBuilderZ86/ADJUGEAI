import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/lib/modules";
import { requireTenant } from "@/lib/session";
import { deconnecter } from "../(auth)/actions";
import { ReinitialiserRechargement } from "@/components/reinitialiser-rechargement";

const ACTIFS = new Set(["qualifier", "chiffrer"]);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, db, tenantId } = await requireTenant();
  const abonnement = await db.abonnement.findUnique({ where: { tenantId } });

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="print:hidden border-b border-slate-200 bg-slate-50 md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center justify-between p-4">
          <Logo />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 text-sm md:flex-col md:overflow-visible">
          <Link href="/tableau-de-bord" className="rounded px-3 py-2 whitespace-nowrap hover:bg-white">
            Tableau de bord
          </Link>
          {MODULES.map((m) =>
            ACTIFS.has(m.cle) ? (
              <Link key={m.cle} href={`/${m.cle}`} className="rounded px-3 py-2 whitespace-nowrap hover:bg-white">
                {m.nom}
              </Link>
            ) : (
              <span key={m.cle} className="flex items-center justify-between gap-2 rounded px-3 py-2 whitespace-nowrap text-slate-400">
                {m.nom}
                <span className="text-[10px] uppercase">V{m.vague}</span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden flex items-center justify-end gap-3 border-b border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-600">
            {user.name} · <span className="font-medium">{abonnement?.palier ?? "GRATUIT"}</span>
          </span>
          <form action={deconnecter}>
            <Button variante="fantome" type="submit">
              Déconnexion
            </Button>
          </form>
        </header>
        <main className="flex-1 p-4 sm:p-8 print:p-0">
          <ReinitialiserRechargement />
          {children}
        </main>
      </div>
    </div>
  );
}
