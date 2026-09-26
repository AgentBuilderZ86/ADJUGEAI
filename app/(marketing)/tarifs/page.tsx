import type { Metadata } from "next";
import { LienBouton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PALIERS } from "@/lib/paliers";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tarifs" };

export default function Tarifs() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Tarifs</h1>
      <p className="mt-2 text-slate-600">Hors taxes, par cabinet ou entreprise. Sans engagement ; -15 % en paiement annuel.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PALIERS.map((p) => (
          <Card key={p.cle} className={cn("flex flex-col", p.cle === "PRO" && "border-marque-700 ring-1 ring-marque-700")}>
            <p className="font-semibold">{p.nom}</p>
            <p className="text-sm text-slate-600">{p.pour}</p>
            <p className="mt-4 text-3xl font-bold">
              {p.prixMensuel ? `${p.prixMensuel.toLocaleString("fr-FR")} MAD` : "Gratuit"}
              {p.prixMensuel ? <span className="text-sm font-normal text-slate-500"> /mois</span> : null}
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.inclus.map((i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-marque-700">✓</span>
                  {i}
                </li>
              ))}
            </ul>
            <LienBouton href="/inscription" variante={p.cle === "PRO" ? "primaire" : "secondaire"} className="mt-6">
              Commencer
            </LienBouton>
          </Card>
        ))}
      </div>
      <Card className="mt-8">
        <p className="font-semibold">Dossier chiffré et expertise</p>
        <p className="mt-1 text-sm text-slate-600">
          Pour un AO stratégique : analyse de prix complète et recommandation argumentée, livrée par un expert des marchés
          publics. Sur devis.
        </p>
      </Card>
    </div>
  );
}
