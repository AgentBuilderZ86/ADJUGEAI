"use server";

import { revalidatePath } from "next/cache";
import {
  enregistrerSimulation,
  importerHistorique,
  QuotaSimulationsAtteint,
  schemaParametres,
  supprimerHistorique,
  supprimerSimulation,
  type TypeChiffrable,
} from "@/lib/chiffrer/service";
import { lireHistorique } from "@/lib/marches/saisie";
import { requireTenant } from "@/lib/session";

export type Etat = { erreur?: string; ok?: string } | undefined;

export async function enregistrer(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  let brut: unknown;
  try {
    brut = JSON.parse(String(form.get("parametres") ?? ""));
  } catch {
    return { erreur: "Paramètres de simulation illisibles." };
  }
  const dossierId = String(form.get("dossierId") ?? "") || undefined;
  const p = schemaParametres.safeParse({ ...(brut as object), dossierId });
  if (!p.success) return { erreur: "Paramètres de simulation invalides." };
  try {
    await enregistrerSimulation({ db, tenantId, userId: user.id, parametres: p.data });
  } catch (e) {
    return { erreur: e instanceof QuotaSimulationsAtteint ? e.message : (e as Error).message };
  }
  revalidatePath("/chiffrer");
  if (dossierId) revalidatePath(`/qualifier/${dossierId}`);
  return { ok: dossierId ? "Simulation enregistrée dans le dossier." : "Simulation enregistrée." };
}

export async function supprimerSim(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  try {
    await supprimerSimulation({ db, tenantId, userId: user.id, simulationId: String(form.get("simulationId") ?? "") });
  } catch (e) {
    return { erreur: (e as Error).message };
  }
  revalidatePath("/chiffrer");
  return { ok: "Simulation supprimée." };
}

const TYPES = new Set(["travaux", "fournitures", "services"]);

export async function importer(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  const type = String(form.get("typeMarche") ?? "");
  if (!TYPES.has(type)) return { erreur: "Type de marché invalide." };
  const { lignes, erreurs } = lireHistorique(String(form.get("lignes") ?? ""));
  if (erreurs.length) return { erreur: `${erreurs.length} ligne(s) illisible(s) : ${erreurs[0]}` };
  try {
    const imp = await importerHistorique({
      db,
      tenantId,
      userId: user.id,
      nom: String(form.get("nom") ?? ""),
      lignes: lignes.map((l) => ({ ...l, typeMarche: type as TypeChiffrable })),
    });
    revalidatePath("/chiffrer");
    revalidatePath("/chiffrer/historique");
    return { ok: `Import « ${imp.nom} » enregistré (${lignes.length} AO).` };
  } catch (e) {
    return { erreur: (e as Error).message };
  }
}

export async function supprimerImport(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  try {
    await supprimerHistorique({ db, tenantId, userId: user.id, importId: String(form.get("importId") ?? "") });
  } catch (e) {
    return { erreur: (e as Error).message };
  }
  revalidatePath("/chiffrer/historique");
  revalidatePath("/chiffrer");
  return { ok: "Import supprimé." };
}
