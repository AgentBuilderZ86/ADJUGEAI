"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { creerCabinet, schemaInscription } from "@/lib/inscription";

/** Les champs non sensibles sont renvoyés pour ne pas vider le formulaire (React réinitialise les champs après une action). */
export type EtatFormulaire = { erreur?: string; valeurs?: Record<string, string> } | undefined;

function valeursNonSensibles(form: FormData) {
  const v: Record<string, string> = {};
  for (const [k, val] of form) if (k !== "motDePasse" && typeof val === "string") v[k] = val;
  return v;
}

export async function inscrire(_: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const parse = schemaInscription.safeParse(Object.fromEntries(form));
  if (!parse.success) return { erreur: parse.error.issues[0].message, valeurs: valeursNonSensibles(form) };
  try {
    await creerCabinet(parse.data);
  } catch (e) {
    return { erreur: (e as Error).message, valeurs: valeursNonSensibles(form) };
  }
  await signIn("credentials", { email: parse.data.email, motDePasse: parse.data.motDePasse, redirectTo: "/tableau-de-bord" });
}

export async function connecter(_: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  try {
    await signIn("credentials", {
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      motDePasse: String(form.get("motDePasse") ?? ""),
      redirectTo: "/tableau-de-bord",
    });
  } catch (e) {
    if (e instanceof AuthError) return { erreur: "Adresse e-mail ou mot de passe incorrect.", valeurs: valeursNonSensibles(form) };
    throw e; // redirection Next.js
  }
}

export async function deconnecter() {
  await signOut({ redirectTo: "/" });
}
