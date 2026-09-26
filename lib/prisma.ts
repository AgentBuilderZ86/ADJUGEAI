import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * DATABASE_URL en local et en CI ; NETLIFY_DB_URL (injectée par Netlify Database) en production
 * et sur les deploy previews, chacune ayant sa propre branche de base.
 */
function urlBase() {
  return process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
}

/**
 * Client brut. À réserver aux données publiques partagées, à l'authentification
 * et aux tâches d'administration. Pour toute donnée cliente : tenantDb() (lib/tenant.ts).
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: urlBase() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
