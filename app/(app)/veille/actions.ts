"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { TypeMarche } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lireMontant } from "@/lib/marches/saisie";
import { requireTenant } from "@/lib/session";
import { lireListeTermes } from "@/lib/veille/correspondance";
import { CollecteInterrompue } from "@/lib/veille/pmmp";
import { collecter, CollecteTropRapprochee, enregistrerProfilVeille, suivreAvis } from "@/lib/veille/service";

export type Etat = { erreur?: string; ok?: string; info?: string } | undefined;

const TYPES: TypeMarche[] = ["TRAVAUX", "FOURNITURES", "SERVICES", "ETUDES"];

export async function sauverProfilVeille(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant(["OWNER", "ADMIN"]);
  const min = String(form.get("estimationMin") ?? "").trim();
  const max = String(form.get("estimationMax") ?? "").trim();
  const estimationMin = min ? lireMontant(min) : null;
  const estimationMax = max ? lireMontant(max) : null;
  if ((min && !estimationMin) || (max && !estimationMax)) return { erreur: "Montant illisible dans la fourchette d'estimation." };
  const criteres = {
    motsCles: lireListeTermes(String(form.get("motsCles") ?? "")),
    exclusions: lireListeTermes(String(form.get("exclusions") ?? "")),
    regions: lireListeTermes(String(form.get("regions") ?? "")),
    typesMarche: TYPES.filter((t) => form.get(`type_${t}`) === "on"),
    estimationMin,
    estimationMax,
  };
  if (!criteres.motsCles.length && !criteres.regions.length && !criteres.typesMarche.length) {
    return { erreur: "Indiquez au moins un mot-clé, une région ou un type de marché." };
  }
  await enregistrerProfilVeille({ db, tenantId, userId: user.id, criteres, alerteEmail: form.get("alerteEmail") === "on" });
  revalidatePath("/veille");
  return { ok: "Profil de veille enregistré." };
}

export async function suivre(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  let dossierId: string;
  try {
    dossierId = (await suivreAvis({ prisma, db, tenantId, userId: user.id, avisId: String(form.get("avisId") ?? "") })).id;
  } catch (e) {
    return { erreur: (e as Error).message };
  }
  revalidatePath("/veille");
  revalidatePath("/qualifier");
  redirect(`/qualifier?dossier=${dossierId}`);
}

export async function actualiser(): Promise<Etat> {
  const { user } = await requireTenant(["OWNER", "ADMIN"]);
  try {
    const j = await collecter(prisma, { declenchePar: user.id, details: 3 });
    revalidatePath("/veille");
    return { ok: `${j.lus} avis lus, dont ${j.nouveaux} nouveaux.` };
  } catch (e) {
    if (e instanceof CollecteTropRapprochee) return { info: e.message };
    if (e instanceof CollecteInterrompue) return { erreur: `${e.message} Réessayez plus tard.` };
    console.error("[veille] actualisation", e);
    return { erreur: "La collecte a échoué. Réessayez plus tard." };
  }
}
