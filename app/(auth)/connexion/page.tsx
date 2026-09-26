"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { connecter } from "../actions";

export default function Connexion() {
  const [etat, action, enCours] = useActionState(connecter, undefined);
  return (
    <Card>
      <h1 className="text-xl font-semibold">Connexion</h1>
      <form action={action} key={etat?.erreur} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={etat?.valeurs?.email} />
        </div>
        <div>
          <Label htmlFor="motDePasse">Mot de passe</Label>
          <Input id="motDePasse" name="motDePasse" type="password" autoComplete="current-password" required />
        </div>
        {etat?.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
        <Button type="submit" className="w-full" disabled={enCours}>
          {enCours ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-marque-700 underline">
          Créer mon espace
        </Link>
      </p>
    </Card>
  );
}
