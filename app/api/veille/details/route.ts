import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CollecteInterrompue, SessionPmmp } from "@/lib/veille/pmmp";
import { appelAutorise } from "@/lib/veille/secret";
import { completerDetails } from "@/lib/veille/service";

export const dynamic = "force-dynamic";

/** Complète quelques fiches détail (estimation, caution) — lot court pour tenir dans la limite des fonctions. */
export async function POST(req: Request) {
  if (!appelAutorise(req)) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  try {
    const n = await completerDetails(prisma, new SessionPmmp(), 8);
    return NextResponse.json({ details: n });
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: e instanceof CollecteInterrompue ? 503 : 500 });
  }
}
