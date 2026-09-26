import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Client brut. À réserver aux données publiques partagées, à l'authentification
 * et aux tâches d'administration. Pour toute donnée cliente : tenantDb() (lib/tenant.ts).
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
