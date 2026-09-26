import { auth } from "@/auth";
import { lireFichier } from "@/lib/constituer/service";
import { prisma } from "@/lib/prisma";
import { stockage } from "@/lib/stockage";
import { tenantDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Fichier d'une pièce du coffre-fort, servi aux seuls utilisateurs du cabinet. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantId) return new Response("Non connecté", { status: 401 });
  const { id } = await params;
  const f = await lireFichier(tenantDb(prisma, session.user.tenantId), id, stockage());
  if (!f) return new Response("Fichier introuvable", { status: 404 });
  const telecharger = new URL(req.url).searchParams.has("telecharger");
  return new Response(f.octets, {
    headers: {
      "content-type": f.type,
      "content-length": String(f.octets.byteLength),
      "content-disposition": `${telecharger ? "attachment" : "inline"}; filename="${f.nom}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      // Le lecteur PDF des navigateurs ne s'ouvre pas dans un document « sandbox » : restriction réservée aux images.
      ...(f.type === "application/pdf" ? {} : { "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
