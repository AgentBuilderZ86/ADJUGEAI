import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appelAutorise } from "@/lib/veille/secret";
import { envoyerAlertes } from "@/lib/veille/alertes";

export const dynamic = "force-dynamic";

/** Récapitulatif e-mail quotidien des nouveaux avis (appelé par la fonction planifiée Netlify). */
export async function POST(req: Request) {
  if (!appelAutorise(req)) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  const urlBase = process.env.URL || new URL(req.url).origin;
  try {
    return NextResponse.json(await envoyerAlertes(prisma, { urlBase }));
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 500 });
  }
}
