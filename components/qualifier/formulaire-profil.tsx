"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { CHAMPS_PROFIL, type ProfilEntreprise } from "@/lib/qualifier/profil";
import { sauverProfil } from "@/app/(app)/qualifier/actions";

export function FormulaireProfil({ profil, modifiable }: { profil: ProfilEntreprise; modifiable: boolean }) {
  const [etat, action, enCours] = useActionState(sauverProfil, undefined);
  const valeurs = etat?.valeurs ?? profil;
  return (
    <form action={action} className="space-y-4" key={etat?.ok}>
      <fieldset disabled={!modifiable} className="space-y-4">
        {CHAMPS_PROFIL.map((c) => (
          <div key={c.cle}>
            <Label htmlFor={c.cle}>{c.libelle}</Label>
            <Textarea id={c.cle} name={c.cle} rows={c.lignes} defaultValue={valeurs[c.cle as keyof typeof valeurs] ?? ""} className="font-sans" />
            <p className="mt-1 text-xs text-slate-500">{c.aide}</p>
          </div>
        ))}
      </fieldset>
      {etat?.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
      {etat?.ok && <p className="text-sm text-marque-800">{etat.ok}</p>}
      {modifiable ? (
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer le profil"}
        </Button>
      ) : (
        <p className="text-sm text-slate-600">Seuls le propriétaire et les administrateurs peuvent modifier le profil.</p>
      )}
    </form>
  );
}
