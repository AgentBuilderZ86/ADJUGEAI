import { NextResponse } from "next/server";
import { claudeDisponible, MODELE_CLAUDE } from "@/lib/claude";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * État de santé du déploiement : base joignable, qualification assistée configurée.
 * N'expose aucune donnée ni aucun secret — uniquement des indicateurs.
 */
export async function GET() {
  let base: "ok" | "erreur" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error("[sante] base", e);
    base = "erreur";
  }
  const corps = {
    base,
    authentification: process.env.AUTH_SECRET ? "configurée" : "absente",
    qualification: claudeDisponible() ? "configurée" : "absente",
    modele: MODELE_CLAUDE,
    version: process.env.COMMIT_REF?.slice(0, 7) ?? "local",
  };
  const ok = base === "ok" && corps.authentification === "configurée";
  return NextResponse.json(corps, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
