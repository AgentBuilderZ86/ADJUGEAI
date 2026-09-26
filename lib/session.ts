import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tenantDb } from "@/lib/tenant";

/**
 * Point d'entrée unique des pages et actions de l'application : résout le cabinet
 * à partir de la session serveur et renvoie un client cloisonné.
 */
export async function requireTenant(rolesAutorises?: Role[]) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/connexion");
  if (rolesAutorises && !rolesAutorises.includes(session.user.role)) {
    throw new Error("Action non autorisée pour votre rôle.");
  }
  return {
    user: session.user,
    tenantId: session.user.tenantId,
    db: tenantDb(prisma, session.user.tenantId),
  };
}
