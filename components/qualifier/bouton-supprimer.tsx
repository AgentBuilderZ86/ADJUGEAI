"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { supprimer } from "@/app/(app)/qualifier/actions";

export function BoutonSupprimer({ dossierId }: { dossierId: string }) {
  const [etat, action, enCours] = useActionState(supprimer, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Supprimer définitivement ce dossier, sa qualification et toutes les données associées ? Cette action est irréversible.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="dossierId" value={dossierId} />
      <Button type="submit" variante="fantome" disabled={enCours} className="text-red-700 hover:bg-red-50">
        {enCours ? "Suppression…" : "Supprimer ce dossier"}
      </Button>
      {etat?.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
    </form>
  );
}
