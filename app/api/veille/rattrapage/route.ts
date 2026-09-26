import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appelAutorise } from "@/lib/veille/secret";
import { enregistrerPageRattrapage, interrompreRattrapage, ouvrirRattrapage } from "@/lib/veille/service";

export const dynamic = "force-dynamic";

const avis = z.object({
  refConsultation: z.string().regex(/^\d+$/),
  orgAcronyme: z.string().regex(/^[a-z0-9]+$/i).max(20),
  reference: z.string().max(300),
  objet: z.string().max(4000),
  procedure: z.string().max(300).nullable(),
  categorie: z.string().max(100).nullable(),
  datePublication: z.coerce.date().nullable(),
  dateLimite: z.coerce.date().nullable(),
  acheteur: z.string().max(500).nullable(),
  lieu: z.string().max(300).nullable(),
  url: z.string().url().startsWith("https://www.marchespublics.gov.ma/"),
});

const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ouvrir") }),
  z.object({
    action: z.literal("page"),
    journalId: z.string().min(1),
    page: z.number().int().min(1).max(100_000),
    derniere: z.boolean(),
    avis: z.array(avis).max(500),
  }),
  z.object({ action: z.literal("interrompre"), journalId: z.string().min(1), message: z.string().max(500) }),
]);

/**
 * Rattrapage des pages anciennes de la liste : la fonction d'arrière-plan lit le portail et
 * envoie ici chaque page analysée ; cette route n'écrit qu'en base.
 */
export async function POST(req: Request) {
  if (!appelAutorise(req)) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  const p = corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "requête invalide" }, { status: 400 });
  try {
    if (p.data.action === "ouvrir") return NextResponse.json(await ouvrirRattrapage(prisma));
    if (p.data.action === "page") return NextResponse.json(await enregistrerPageRattrapage(prisma, p.data));
    await interrompreRattrapage(prisma, p.data.journalId, p.data.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 409 });
  }
}
