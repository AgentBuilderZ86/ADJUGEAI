import type { Metadata } from "next";
import { Calculateur } from "@/components/chiffrer/calculateur";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Calculateur du prix de référence — décret 2-22-431",
  description:
    "Calculez gratuitement le prix de référence, les offres anormalement basses et excessives, l'offre mieux-disante et le prix optimal à déposer pour un marché public marocain.",
};

export default function PageCalculateur() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Calculateur du prix de référence</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Gratuit et sans inscription. Anticipez le prix de référence et vos chances de gagner avant de déposer, ou vérifiez
        le classement d&apos;une séance d&apos;ouverture des plis. Les calculs se font dans votre navigateur : aucune
        donnée n&apos;est envoyée.
      </p>
      <div className="mt-8">
        <Calculateur />
      </div>
      <div className="mt-12 rounded-lg bg-marque-900 p-6 text-white sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Calibrez vos simulations sur les résultats réels de vos acheteurs</p>
          <p className="mt-1 text-sm text-marque-100">
            Historique des offres par acheteur et concurrent, qualification GO / NO GO, suivi du dossier jusqu&apos;au
            paiement.
          </p>
        </div>
        <LienBouton href="/inscription" variante="secondaire" className="mt-4 sm:mt-0">
          Créer mon espace gratuit
        </LienBouton>
      </div>
    </div>
  );
}
