"use client";

import { useActionState } from "react";
import type { Verdict } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { LIBELLES_VERDICT } from "@/lib/qualifier/grille";
import { corriger } from "@/app/(app)/qualifier/actions";

export function FormulaireCorrection({ qualificationId, dossierId, verdict }: { qualificationId: string; dossierId: string; verdict: Verdict }) {
  const [etat, action, enCours] = useActionState(corriger, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Confirmer la correction du verdict ? Elle sera tracée et servira à ajuster la grille.")) e.preventDefault();
      }}
      className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="qualificationId" value={qualificationId} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <div>
        <Label htmlFor="verdict">Votre décision</Label>
        <Select id="verdict" name="verdict" defaultValue={verdict}>
          {(Object.keys(LIBELLES_VERDICT) as Verdict[]).map((v) => (
            <option key={v} value={v}>
              {LIBELLES_VERDICT[v]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="commentaire">Pourquoi ?</Label>
        <Input id="commentaire" name="commentaire" placeholder="ex. référence couverte via notre partenaire de groupement" />
      </div>
      <Button type="submit" variante="secondaire" disabled={enCours}>
        Corriger
      </Button>
      {etat?.erreur && <p className="text-sm text-red-700 sm:col-span-3">{etat.erreur}</p>}
      {etat?.ok && <p className="text-sm text-marque-800 sm:col-span-3">{etat.ok}</p>}
    </form>
  );
}
