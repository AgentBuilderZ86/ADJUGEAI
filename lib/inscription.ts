import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const schemaInscription = z.object({
  cabinet: z.string().trim().min(2, "Nom du cabinet trop court"),
  secteur: z.string().trim().optional(),
  nom: z.string().trim().min(2, "Indiquez votre nom"),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  motDePasse: z.string().min(10, "10 caractères minimum"),
  consentement: z.literal("on", { message: "Le consentement au traitement des données est requis (loi 09-08)" }),
});

export type DonneesInscription = z.infer<typeof schemaInscription>;

/** Crée le cabinet, son propriétaire, un abonnement gratuit et la trace d'audit, en une transaction. */
export async function creerCabinet(d: DonneesInscription) {
  const existe = await prisma.user.findUnique({ where: { email: d.email } });
  if (existe) throw new Error("Un compte existe déjà avec cette adresse e-mail.");
  const hash = await bcrypt.hash(d.motDePasse, 12);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { nom: d.cabinet, secteur: d.secteur || null } });
    const user = await tx.user.create({
      data: { tenantId: tenant.id, email: d.email, nom: d.nom, motDePasse: hash, role: "OWNER" },
    });
    await tx.abonnement.create({ data: { tenantId: tenant.id, palier: "GRATUIT", statut: "ESSAI" } });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        action: "cabinet.creation",
        cible: `Tenant:${tenant.id}`,
        apres: { nom: tenant.nom, consentementLoi0908: new Date().toISOString() },
      },
    });
    return { tenant, user };
  });
}
