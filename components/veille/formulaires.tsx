"use client";

import { useActionState } from "react";
import type { TypeMarche } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { actualiser, sauverProfilVeille, suivre } from "@/app/(app)/veille/actions";

export interface ValeursProfil {
  motsCles: string[];
  exclusions: string[];
  regions: string[];
  typesMarche: TypeMarche[];
  estimationMin: number | null;
  estimationMax: number | null;
  alerteEmail: boolean;
}

const TYPES: { v: TypeMarche; l: string }[] = [
  { v: "TRAVAUX", l: "Travaux" },
  { v: "FOURNITURES", l: "Fournitures" },
  { v: "SERVICES", l: "Services" },
  { v: "ETUDES", l: "Études" },
];

export function FormulaireProfilVeille({ profil, modifiable }: { profil: ValeursProfil | null; modifiable: boolean }) {
  const [etat, action, enCours] = useActionState(sauverProfilVeille, undefined);
  const p = profil ?? { motsCles: [], exclusions: [], regions: [], typesMarche: [], estimationMin: null, estimationMax: null, alerteEmail: true };
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={!modifiable} className="space-y-4">
        <div>
          <Label htmlFor="motsCles">Mots-clés</Label>
          <Textarea id="motsCles" name="motsCles" rows={3} defaultValue={p.motsCles.join(", ")} className="font-sans" placeholder="voirie, assainissement, réhabilitation, schéma directeur…" />
          <p className="mt-1 text-xs text-slate-500">Séparés par des virgules. Un avis doit contenir au moins l&apos;un d&apos;eux (objet ou acheteur).</p>
        </div>
        <div>
          <Label htmlFor="exclusions">Mots à exclure</Label>
          <Input id="exclusions" name="exclusions" defaultValue={p.exclusions.join(", ")} placeholder="gardiennage, nettoyage…" />
        </div>
        <div>
          <Label htmlFor="regions">Villes ou provinces d&apos;exécution</Label>
          <Input id="regions" name="regions" defaultValue={p.regions.join(", ")} placeholder="Casablanca, Rabat, Kénitra… (vide = tout le Maroc)" />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Types de marché</span>
          <div className="flex flex-wrap gap-4 text-sm">
            {TYPES.map((t) => (
              <label key={t.v} className="flex items-center gap-2">
                <input type="checkbox" name={`type_${t.v}`} defaultChecked={p.typesMarche.includes(t.v)} className="accent-marque-700" />
                {t.l}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="estimationMin">Estimation min. (MAD)</Label>
            <Input id="estimationMin" name="estimationMin" inputMode="decimal" defaultValue={p.estimationMin ?? ""} />
          </div>
          <div>
            <Label htmlFor="estimationMax">Estimation max. (MAD)</Label>
            <Input id="estimationMax" name="estimationMax" inputMode="decimal" defaultValue={p.estimationMax ?? ""} />
          </div>
        </div>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="alerteEmail" defaultChecked={p.alerteEmail} className="accent-marque-700" />
          M&apos;alerter par e-mail des nouveaux avis (bientôt disponible)
        </label>
      </fieldset>
      {etat?.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
      {etat?.ok && <p className="text-sm text-marque-800">{etat.ok}</p>}
      {modifiable ? (
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer le profil"}
        </Button>
      ) : (
        <p className="text-sm text-slate-600">Seuls le propriétaire et les administrateurs peuvent modifier le profil de veille.</p>
      )}
    </form>
  );
}

export function BoutonSuivre({ avisId }: { avisId: string }) {
  const [etat, action, enCours] = useActionState(suivre, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="avisId" value={avisId} />
      <Button type="submit" variante="secondaire" disabled={enCours} className="whitespace-nowrap">
        {enCours ? "…" : "Suivre et qualifier"}
      </Button>
      {etat?.erreur && <p className="text-xs text-red-700">{etat.erreur}</p>}
    </form>
  );
}

export function BoutonActualiser() {
  const [etat, action, enCours] = useActionState(actualiser, undefined);
  return (
    <form action={action} className="text-right">
      <Button type="submit" variante="secondaire" disabled={enCours}>
        {enCours ? "Collecte en cours (≈ 30 s)…" : "Actualiser les avis"}
      </Button>
      {etat?.erreur && <p className="mt-1 max-w-xs text-xs text-red-700">{etat.erreur}</p>}
      {etat?.ok && <p className="mt-1 text-xs text-marque-800">{etat.ok}</p>}
      {etat?.info && <p className="mt-1 max-w-xs text-xs text-slate-600">{etat.info}</p>}
    </form>
  );
}
