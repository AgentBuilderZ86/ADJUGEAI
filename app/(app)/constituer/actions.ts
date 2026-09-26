"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ajouterExigence,
  enregistrerPiece,
  modifierExigence,
  preparerListe,
  schemaExigence,
  schemaPiece,
  supprimerExigence,
  supprimerPiece,
} from "@/lib/constituer/service";
import { requireTenant } from "@/lib/session";

export type Etat = { erreur?: string; ok?: string } | undefined;

function lireDate(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function premiereErreur(e: unknown) {
  return e instanceof z.ZodError ? (e.issues[0]?.message ?? "Saisie invalide.") : (e as Error).message;
}

export async function ajouterPiece(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  const donnees = {
    type: String(form.get("type") ?? ""),
    libelle: String(form.get("libelle") ?? ""),
    numero: String(form.get("numero") ?? ""),
    delivreLe: lireDate(form.get("delivreLe")),
    expireLe: lireDate(form.get("expireLe")),
  };
  const p = schemaPiece.safeParse(donnees);
  if (!p.success) return { erreur: p.error.issues[0]?.message ?? "Saisie invalide." };
  try {
    await enregistrerPiece({ db, tenantId, userId: user.id, donnees: p.data });
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  revalidatePath("/constituer", "layout");
  return { ok: "Pièce ajoutée au coffre-fort." };
}

export async function retirerPiece(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  try {
    await supprimerPiece({ db, tenantId, userId: user.id, pieceId: String(form.get("pieceId") ?? "") });
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  revalidatePath("/constituer", "layout");
  return { ok: "Pièce retirée." };
}

export async function preparer(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  const dossierId = String(form.get("dossierId") ?? "");
  try {
    await preparerListe({ db, tenantId, userId: user.id, dossierId });
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  revalidatePath(`/constituer/${dossierId}`);
  revalidatePath("/constituer");
  return { ok: "Liste des pièces préparée." };
}

export async function ajouter(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId } = await requireTenant();
  const dossierId = String(form.get("dossierId") ?? "");
  const d = schemaExigence.safeParse({
    enveloppe: String(form.get("enveloppe") ?? ""),
    libelle: String(form.get("libelle") ?? ""),
    eliminatoire: form.get("eliminatoire") === "on",
  });
  if (!d.success) return { erreur: d.error.issues[0]?.message ?? "Saisie invalide." };
  try {
    await ajouterExigence({ db, tenantId, dossierId, donnees: d.data });
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  revalidatePath(`/constituer/${dossierId}`);
  return { ok: "Pièce ajoutée." };
}

const STATUTS = z.enum(["MANQUANTE", "EN_COURS", "PRETE", "EXPIREE"]);

export async function modifier(_: Etat, form: FormData): Promise<Etat> {
  const { db } = await requireTenant();
  const statut = STATUTS.safeParse(form.get("statut"));
  try {
    const e = await modifierExigence({
      db,
      id: String(form.get("id") ?? ""),
      statut: statut.success ? statut.data : undefined,
      responsable: form.has("responsable") ? String(form.get("responsable")) : undefined,
    });
    revalidatePath(`/constituer/${e.dossierId}`);
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  return { ok: "Enregistré." };
}

export async function retirer(_: Etat, form: FormData): Promise<Etat> {
  const { db } = await requireTenant();
  const dossierId = String(form.get("dossierId") ?? "");
  try {
    await supprimerExigence({ db, id: String(form.get("id") ?? "") });
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  revalidatePath(`/constituer/${dossierId}`);
  return { ok: "Pièce retirée de la liste." };
}
