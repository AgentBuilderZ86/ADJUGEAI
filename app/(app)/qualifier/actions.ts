"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Verdict } from "@prisma/client";
import { claude, messageErreurClaude } from "@/lib/claude";
import { analyserAo, AnalyseImpossible } from "@/lib/qualifier/analyse";
import { CHAMPS_PROFIL, schemaProfil } from "@/lib/qualifier/profil";
import { corrigerVerdict, enregistrerProfil, qualifierAo, QuotaAtteint } from "@/lib/qualifier/service";
import { requireTenant } from "@/lib/session";

export type Etat = { erreur?: string; ok?: string; valeurs?: Record<string, string> } | undefined;

/** Au-delà, la requête dépasse la limite des fonctions Netlify (6 Mo, encodage compris). */
const TAILLE_MAX_PDF = 4 * 1024 * 1024;

export async function lancerQualification(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  const valeurs = { titre: String(form.get("titre") ?? ""), texte: String(form.get("texte") ?? ""), precisions: String(form.get("precisions") ?? "") };
  const fichier = form.get("fichier");
  let pdfBase64: string | undefined;

  if (fichier instanceof File && fichier.size > 0) {
    if (fichier.type !== "application/pdf") return { erreur: "Seuls les fichiers PDF sont acceptés.", valeurs };
    if (fichier.size > TAILLE_MAX_PDF) {
      return { erreur: "PDF trop volumineux (4 Mo max). Joignez le RC et le CPS seuls, ou collez leur texte.", valeurs };
    }
    pdfBase64 = Buffer.from(await fichier.arrayBuffer()).toString("base64");
  }
  if (!pdfBase64 && valeurs.texte.trim().length < 200) {
    return { erreur: "Collez le texte du CPS ou du RC (au moins quelques paragraphes), ou joignez le PDF.", valeurs };
  }

  let dossierId: string;
  try {
    const { dossier } = await qualifierAo({
      db,
      tenantId,
      userId: user.id,
      titre: valeurs.titre,
      entree: { texte: valeurs.texte, pdfBase64, precisions: valeurs.precisions },
      analyser: (e) => analyserAo(claude(), e),
    });
    dossierId = dossier.id;
  } catch (e) {
    if (e instanceof QuotaAtteint || e instanceof AnalyseImpossible) return { erreur: e.message, valeurs };
    console.error("[qualifier]", e);
    return { erreur: messageErreurClaude(e), valeurs };
  }
  revalidatePath("/qualifier");
  redirect(`/qualifier/${dossierId}`);
}

const schemaCorrection = z.object({
  qualificationId: z.string().min(1),
  dossierId: z.string().min(1),
  verdict: z.enum(["GO", "GO_CONDITIONNEL", "NO_GO_DEFAUT", "NO_GO"]),
  commentaire: z.string().trim().min(5, "Expliquez la correction en quelques mots : elle sert à ajuster la grille."),
});

export async function corriger(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant();
  const p = schemaCorrection.safeParse(Object.fromEntries(form));
  if (!p.success) return { erreur: p.error.issues[0].message };
  try {
    await corrigerVerdict({ db, tenantId, userId: user.id, qualificationId: p.data.qualificationId, verdict: p.data.verdict as Verdict, commentaire: p.data.commentaire });
  } catch (e) {
    return { erreur: (e as Error).message };
  }
  revalidatePath(`/qualifier/${p.data.dossierId}`);
  revalidatePath("/qualifier");
  return { ok: "Verdict corrigé et enregistré pour ajuster la grille." };
}

export async function sauverProfil(_: Etat, form: FormData): Promise<Etat> {
  const { db, tenantId, user } = await requireTenant(["OWNER", "ADMIN"]);
  const brut = Object.fromEntries(CHAMPS_PROFIL.map((c) => [c.cle, String(form.get(c.cle) ?? "")]));
  const profil = schemaProfil.parse(brut);
  await enregistrerProfil({ db, tenantId, userId: user.id, profil });
  revalidatePath("/qualifier");
  return { ok: "Profil enregistré.", valeurs: brut };
}
