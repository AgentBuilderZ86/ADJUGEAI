"use client";

import { useActionState, useState } from "react";
import type { StatutPiece } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { ajouter, ajouterPiece, modifier, preparer, retirer, retirerPiece } from "@/app/(app)/constituer/actions";
import { ENVELOPPES, TYPES_PIECE } from "@/lib/constituer/catalogue";

function Message({ etat }: { etat?: { erreur?: string; ok?: string } }) {
  if (etat?.erreur) return <p className="text-sm text-red-700">{etat.erreur}</p>;
  if (etat?.ok) return <p className="text-sm text-marque-800">{etat.ok}</p>;
  return null;
}

export function FormulairePiece() {
  const [ajouts, setAjouts] = useState(0);
  const [etat, action, enCours] = useActionState(async (prec: Awaited<ReturnType<typeof ajouterPiece>>, form: FormData) => {
    const r = await ajouterPiece(prec, form);
    if (r?.ok) setAjouts((n) => n + 1);
    return r;
  }, undefined);
  return (
    <form action={action} className="space-y-3">
      <ChampsPiece key={ajouts} />
      <Message etat={etat} />
      <Button type="submit" disabled={enCours}>
        {enCours ? "Ajout…" : "Ajouter au coffre-fort"}
      </Button>
    </form>
  );
}

/** Champs de saisie, remontés à neuf après chaque ajout (le type choisi pilote l'aide affichée). */
function ChampsPiece() {
  const [type, setType] = useState(TYPES_PIECE[0].cle);
  const t = TYPES_PIECE.find((x) => x.cle === type)!;
  return (
    <>
      <div>
        <Label htmlFor="type">Type de pièce</Label>
        <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES_PIECE.map((x) => (
            <option key={x.cle} value={x.cle}>
              {x.libelle}
            </option>
          ))}
        </Select>
        {t.aide && <p className="mt-1 text-xs text-slate-500">{t.aide}</p>}
      </div>
      <div>
        <Label htmlFor="libelle">Intitulé (facultatif)</Label>
        <Input id="libelle" name="libelle" placeholder={t.libelle} />
      </div>
      <div>
        <Label htmlFor="numero">Numéro ou référence</Label>
        <Input id="numero" name="numero" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="delivreLe">Délivrée le</Label>
          <Input id="delivreLe" name="delivreLe" type="date" />
        </div>
        <div>
          <Label htmlFor="expireLe">Valable jusqu&apos;au</Label>
          <Input id="expireLe" name="expireLe" type="date" />
        </div>
      </div>
      {t.validiteMois && (
        <p className="text-xs text-slate-500">
          Sans échéance saisie, elle est calculée : {t.validiteMois} mois après la délivrance ({t.source} du décret).
        </p>
      )}
    </>
  );
}

export function BoutonRetirerPiece({ pieceId }: { pieceId: string }) {
  const [etat, action, enCours] = useActionState(retirerPiece, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Retirer cette pièce du coffre-fort ?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="pieceId" value={pieceId} />
      <button type="submit" disabled={enCours} className="text-xs text-slate-500 underline hover:text-red-700">
        Retirer
      </button>
      {etat?.erreur && <p className="text-xs text-red-700">{etat.erreur}</p>}
    </form>
  );
}

export function BoutonPreparer({ dossierId }: { dossierId: string }) {
  const [etat, action, enCours] = useActionState(preparer, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="dossierId" value={dossierId} />
      <Button type="submit" disabled={enCours}>
        {enCours ? "Préparation…" : "Préparer la liste des pièces"}
      </Button>
      <Message etat={etat} />
    </form>
  );
}

const STATUTS: { v: StatutPiece; l: string }[] = [
  { v: "MANQUANTE", l: "Manquante" },
  { v: "EN_COURS", l: "En cours" },
  { v: "PRETE", l: "Prête" },
  { v: "EXPIREE", l: "Expirée" },
];

export function ChampsExigence({ id, statut, responsable, verrouille }: { id: string; statut: StatutPiece; responsable: string | null; verrouille: boolean }) {
  const [etat, action, enCours] = useActionState(modifier, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {!verrouille && (
        <Select
          name="statut"
          defaultValue={statut}
          aria-label="Statut"
          className="w-auto py-1"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {STATUTS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.l}
            </option>
          ))}
        </Select>
      )}
      <Input
        name="responsable"
        defaultValue={responsable ?? ""}
        placeholder="Responsable"
        aria-label="Responsable"
        className="w-36 py-1"
        onBlur={(e) => {
          if (e.currentTarget.value !== (responsable ?? "")) e.currentTarget.form?.requestSubmit();
        }}
      />
      {enCours && <span className="text-xs text-slate-500">…</span>}
      {etat?.erreur && <span className="text-xs text-red-700">{etat.erreur}</span>}
    </form>
  );
}

export function BoutonRetirerExigence({ id, dossierId }: { id: string; dossierId: string }) {
  const [, action, enCours] = useActionState(retirer, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dossierId" value={dossierId} />
      <button type="submit" disabled={enCours} className="text-xs text-slate-400 hover:text-red-700" aria-label="Retirer de la liste">
        ✕
      </button>
    </form>
  );
}

export function FormulaireExigence({ dossierId }: { dossierId: string }) {
  const [etat, action, enCours] = useActionState(ajouter, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto_auto] sm:items-end">
      <input type="hidden" name="dossierId" value={dossierId} />
      <div>
        <Label htmlFor="enveloppe">Enveloppe</Label>
        <Select id="enveloppe" name="enveloppe" defaultValue="autre">
          {ENVELOPPES.map((e) => (
            <option key={e.cle} value={e.cle}>
              {e.libelle}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="libelle-exigence">Pièce</Label>
        <Input id="libelle-exigence" name="libelle" placeholder="Ex. : attestation de visite des lieux" />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="eliminatoire" className="accent-marque-700" />
        Éliminatoire
      </label>
      <Button type="submit" variante="secondaire" disabled={enCours}>
        Ajouter
      </Button>
      <div className="sm:col-span-4">
        <Message etat={etat} />
      </div>
    </form>
  );
}
