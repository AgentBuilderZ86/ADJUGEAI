import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CollecteInterrompue } from "@/lib/veille/pmmp";
import { appelAutorise } from "@/lib/veille/secret";
import { collecter, CollecteTropRapprochee } from "@/lib/veille/service";

export const dynamic = "force-dynamic";

/** Collecte planifiée des avis récents (appelée par la fonction d'arrière-plan Netlify). */
export async function POST(req: Request) {
  if (!appelAutorise(req)) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  try {
    const j = await collecter(prisma, { declenchePar: "planification" });
    return NextResponse.json({ statut: j.statut, lus: j.lus, nouveaux: j.nouveaux });
  } catch (e) {
    const code = e instanceof CollecteTropRapprochee ? 429 : e instanceof CollecteInterrompue ? 503 : 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status: code });
  }
}
