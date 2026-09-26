import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Cloisonnement strict par cabinet (tenant).
 *
 * tenantDb(tenantId) renvoie un client Prisma qui, pour chaque modèle portant un tenantId :
 *  - ajoute `tenantId` au filtre de toute lecture, mise à jour et suppression ;
 *  - force `tenantId` à la création : toute valeur fournie par l'appelant est écrasée par celle de la session
 *    (les types Prisma exigent de la fournir ; passez celle de requireTenant()).
 *
 * Le tenantId provient TOUJOURS de la session serveur, jamais du client (voir requireTenant()).
 */

/** Modèles de données clientes. Tenant, User et Invitation sont gérés à part (authentification). */
export const MODELES_CLOISONNES = new Set<string>(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "tenantId") && !["User", "Invitation"].includes(m.name))
    .map((m) => m.name),
);

const LECTURES_FILTREES = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

export function tenantDb(base: PrismaClient, tenantId: string) {
  if (!tenantId) throw new Error("tenantId manquant : accès refusé.");

  return base.$extends({
    name: "cloisonnement-tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !MODELES_CLOISONNES.has(model)) return query(args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (args ?? {}) as any;

          if (LECTURES_FILTREES.has(operation)) {
            a.where = { ...(a.where ?? {}), tenantId };
          }
          if (operation === "create") {
            a.data = { ...(a.data ?? {}), tenantId };
          }
          if (operation === "createMany" || operation === "createManyAndReturn") {
            a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: object) => ({ ...d, tenantId }));
          }
          if (operation === "upsert") {
            a.create = { ...(a.create ?? {}), tenantId };
          }
          const modifications = operation === "upsert" ? a.update : a.data;
          if (["update", "updateMany", "upsert"].includes(operation) && (modifications?.tenantId || modifications?.tenant)) {
            throw new Error("Changement de tenant interdit.");
          }
          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
