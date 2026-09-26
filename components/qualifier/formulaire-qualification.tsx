"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { lancerQualification } from "@/app/(app)/qualifier/actions";

export function FormulaireQualification({ desactive }: { desactive?: string }) {
  const [etat, action, enCours] = useActionState(lancerQualification, undefined);
  const [nomFichier, setNomFichier] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-4" key={etat?.erreur}>
      <div>
        <Label htmlFor="titre">Intitulé (facultatif)</Label>
        <Input id="titre" name="titre" defaultValue={etat?.valeurs?.titre} placeholder="Déduit automatiquement de l'AO si vide" />
      </div>
      <div>
        <Label htmlFor="fichier">Dossier de l&apos;AO en PDF (RC, CPS — 4 Mo max)</Label>
        <input
          id="fichier"
          name="fichier"
          type="file"
          accept="application/pdf"
          onChange={(e) => setNomFichier(e.target.files?.[0]?.name ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-marque-50 file:px-3 file:py-2 file:text-marque-800 hover:file:bg-marque-100"
        />
        {nomFichier && <p className="mt-1 text-xs text-slate-500">{nomFichier}</p>}
      </div>
      <div>
        <Label htmlFor="texte">… ou texte du CPS / RC</Label>
        <Textarea id="texte" name="texte" rows={8} defaultValue={etat?.valeurs?.texte} placeholder="Collez ici le règlement de consultation et le CPS" className="font-sans" />
      </div>
      <div>
        <Label htmlFor="precisions">Précisions (facultatif)</Label>
        <Input id="precisions" name="precisions" defaultValue={etat?.valeurs?.precisions} placeholder="ex. nous visons ce client ; groupement possible avec un bureau d'études" />
      </div>
      {etat?.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
      <Button type="submit" className="w-full" disabled={enCours || Boolean(desactive)}>
        {enCours ? "Analyse en cours… (30 à 60 secondes)" : "Qualifier cet AO"}
      </Button>
      {desactive && <p className="text-sm text-slate-600">{desactive}</p>}
      <p className="text-xs text-slate-500">
        Seuls le dossier de l&apos;AO et le profil de votre entreprise sont transmis au moteur d&apos;analyse. Évitez d&apos;y inclure des données personnelles.
      </p>
    </form>
  );
}
