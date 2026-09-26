"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { enregistrer } from "@/app/(app)/chiffrer/actions";

export interface OptionsEnregistrement {
  dossiers: { id: string; titre: string }[];
  dossierId?: string;
}

/** Enregistre la simulation affichée (recalculée côté serveur), éventuellement dans un dossier. */
export function FormulaireEnregistrement({ parametres, options }: { parametres: object; options: OptionsEnregistrement }) {
  const [etat, action, enCours] = useActionState(enregistrer, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="parametres" value={JSON.stringify(parametres)} />
      <div className="min-w-0 flex-1">
        <Label htmlFor="dossierId">Rattacher à un dossier</Label>
        <Select id="dossierId" name="dossierId" defaultValue={options.dossierId ?? ""}>
          <option value="">Aucun dossier</option>
          {options.dossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.titre.length > 80 ? `${d.titre.slice(0, 80)}…` : d.titre}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer la simulation"}
      </Button>
      {etat?.erreur && <p className="w-full text-sm text-red-700">{etat.erreur}</p>}
      {etat?.ok && <p className="w-full text-sm text-marque-800">{etat.ok}</p>}
    </form>
  );
}
