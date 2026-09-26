"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { importer, supprimerImport } from "@/app/(app)/chiffrer/actions";

export function FormulaireImport() {
  const [etat, action, enCours] = useActionState(importer, undefined);
  return (
    <form action={action} className="space-y-4" key={etat?.ok}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="nom">Nom de l&apos;import</Label>
          <Input id="nom" name="nom" placeholder="ex. AO travaux 2025 — région Casablanca" />
        </div>
        <div>
          <Label htmlFor="typeMarche">Type de marché</Label>
          <Select id="typeMarche" name="typeMarche" defaultValue="travaux">
            <option value="travaux">Travaux</option>
            <option value="fournitures">Fournitures</option>
            <option value="services">Services (hors études)</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="lignes">Résultats d&apos;AO passés</Label>
        <Textarea
          id="lignes"
          name="lignes"
          rows={10}
          required
          placeholder={"Une ligne par AO : estimation ; offre 1 ; offre 2 ; …\n1 800 000 ; 1 650 000 ; 1 720 000 ; 1 910 000\n950 000 ; 870 000 ; 905 000"}
        />
        <p className="mt-1 text-xs text-slate-500">
          Les montants lus en séance d&apos;ouverture des plis (PV). Copier-coller depuis Excel accepté (colonnes séparées par tabulation).
        </p>
      </div>
      {etat?.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
      {etat?.ok && <p className="text-sm text-marque-800">{etat.ok}</p>}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Import…" : "Importer"}
      </Button>
    </form>
  );
}

export function BoutonSupprimerImport({ id }: { id: string }) {
  const [etat, action, enCours] = useActionState(supprimerImport, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Supprimer cet import de l'historique ?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="importId" value={id} />
      <button type="submit" disabled={enCours} className="text-xs text-red-700 hover:underline" title={etat?.erreur}>
        Supprimer
      </button>
    </form>
  );
}
