import Link from "next/link";
import { LienBouton } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-1 text-sm sm:gap-4">
            <Link href="/calculateur" className="hidden px-2 hover:text-marque-700 sm:inline">
              Calculateur gratuit
            </Link>
            <Link href="/tarifs" className="hidden px-2 hover:text-marque-700 sm:inline">
              Tarifs
            </Link>
            <LienBouton href="/connexion" variante="fantome">
              Connexion
            </LienBouton>
            <LienBouton href="/inscription">Essai gratuit</LienBouton>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 text-sm text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Adjugé — IO Advisory</p>
          <p>
            Données personnelles traitées conformément à la loi 09-08.{" "}
            <Link href="/calculateur" className="underline">
              Calculateur du prix de référence
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
