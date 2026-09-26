"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ajouterExigence,
  enregistrerPiece,
  joindreFichier,
  modifierExigence,
  preparerListe,
  schemaExigence,
  schemaPiece,
  supprimerExigence,
  supprimerPiece,
} from "@/lib/constituer/service";
import { FichierRefuse } from "@/lib/constituer/fichier";
import { requireTenant } from "@/lib/session";
import { stockage, StockageIndisponible } from "@/lib/stockage";

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

/** Fichier facultatif d'un formulaire (champ « fichier »). */
function lireFichier(form: FormData) {
  const f = form.get("fichier");
  return f instanceof File && f.size > 0 ? f : null;
}

function erreurFichier(e: unknown) {
  if (e instanceof FichierRefuse || e instanceof StockageIndisponible) return e.message;
  console.error("[coffre-fort] fichier", e);
  return "Le fichier n'a pas pu être enregistré. Réessayez.";
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
  let pieceId: string;
  try {
    pieceId = (await enregistrerPiece({ db, tenantId, userId: user.id, donnees: p.data })).id;
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  revalidatePath("/constituer", "layout");
  const fichier = lireFichier(form);
  if (!fichier) return { ok: "Pièce ajoutée au coffre-fort." };
  try {
    await joindreFichier({ db, tenantId, userId: user.id, pieceId, fichier: { nom: fichier.name, octets: await fichier.arrayBuffer() }, stockage: stockage() });
  } catch (e) {
    return { erreur: `Pièce ajoutée, mais sans fichier : ${erreurFichier(e)}` };
  }
  return { ok: "Pièce et fichier ajoutés au coffre-fort." };
}

export async function retirerPiece(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  try {
    await supprimerPiece({ db, tenantId, userId: user.id, pieceId: String(form.get("pieceId") ?? ""), stockage: stockage() });
  } catch (e) {
    return { erreur: premiereErreur(e) };
  }
  revalidatePath("/constituer", "layout");
  return { ok: "Pièce retirée." };
}

export async function joindre(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  const fichier = lireFichier(form);
  if (!fichier) return { erreur: "Choisissez un fichier." };
  try {
    await joindreFichier({
      db,
      tenantId,
      userId: user.id,
      pieceId: String(form.get("pieceId") ?? ""),
      fichier: { nom: fichier.name, octets: await fichier.arrayBuffer() },
      stockage: stockage(),
    });
  } catch (e) {
    return { erreur: e instanceof Error && e.message === "Pièce introuvable." ? e.message : erreurFichier(e) };
  }
  revalidatePath("/constituer", "layout");
  return { ok: "Fichier enregistré." };
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
