"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { inscrire } from "../actions";

export default function Inscription() {
  const [etat, action, enCours] = useActionState(inscrire, undefined);
  return (
    <Card>
      <h1 className="text-xl font-semibold">Créer l&apos;espace de votre entreprise</h1>
      <p className="mt-1 text-sm text-slate-600">Gratuit, sans carte bancaire. Vous pourrez inviter votre équipe ensuite.</p>
      <form action={action} key={etat?.erreur} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="cabinet">Entreprise ou cabinet</Label>
          <Input id="cabinet" name="cabinet" defaultValue={etat?.valeurs?.cabinet} required autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor="secteur">Secteur (facultatif)</Label>
          <Input id="secteur" name="secteur" defaultValue={etat?.valeurs?.secteur} placeholder="BTP, fournitures, ingénierie, conseil…" />
        </div>
        <div>
          <Label htmlFor="nom">Votre nom</Label>
          <Input id="nom" name="nom" defaultValue={etat?.valeurs?.nom} required autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">Adresse e-mail professionnelle</Label>
          <Input id="email" name="email" defaultValue={etat?.valeurs?.email} type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="motDePasse">Mot de passe (10 caractères minimum)</Label>
          <Input id="motDePasse" name="motDePasse" type="password" minLength={10} required autoComplete="new-password" />
        </div>
        <label className="flex gap-2 text-xs text-slate-600">
          <input type="checkbox" name="consentement" required defaultChecked={etat?.valeurs?.consentement === "on"} className="mt-0.5 accent-marque-700" />
          <span>
            J&apos;accepte le traitement de mes données personnelles aux seules fins de fourniture du service, conformément
            à la loi 09-08. Je peux demander leur effacement à tout moment.
          </span>
        </label>
        {etat?.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
        <Button type="submit" className="w-full" disabled={enCours}>
          {enCours ? "Création…" : "Créer mon espace"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-marque-700 underline">
          Se connecter
        </Link>
      </p>
    </Card>
  );
}
