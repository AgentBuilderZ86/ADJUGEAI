/**
 * Test d'isolation obligatoire avant toute mise en production (spec, section XI) :
 * un cabinet ne doit jamais pouvoir lire, modifier ou supprimer les données d'un autre,
 * y compris en tentant de forcer l'identifiant d'un objet ou le tenantId.
 *
 * Nécessite une base PostgreSQL : DATABASE_URL=... npm run test:integration
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODELES_CLOISONNES, tenantDb } from "@/lib/tenant";

const base = new PrismaClient();
let A: string;
let B: string;
let dossierB: string;

describe.skipIf(!process.env.DATABASE_URL)("isolation entre cabinets", () => {
  beforeAll(async () => {
    A = (await base.tenant.create({ data: { nom: "Cabinet A (test)" } })).id;
    B = (await base.tenant.create({ data: { nom: "Cabinet B (test)" } })).id;
    dossierB = (await tenantDb(base, B).dossier.create({ data: { tenantId: B, titre: "AO confidentiel de B", estimation: 1_000_000 } })).id;
    await tenantDb(base, B).compte.create({ data: { tenantId: B, nom: "Client stratégique de B" } });
  });

  afterAll(async () => {
    await base.tenant.deleteMany({ where: { id: { in: [A, B] } } });
    await base.$disconnect();
  });

  it("couvre tous les modèles métier", () => {
    for (const m of ["Dossier", "Qualification", "SimulationPrix", "Projet", "Decompte", "Compte", "AuditLog"]) {
      expect(MODELES_CLOISONNES.has(m)).toBe(true);
    }
    expect(MODELES_CLOISONNES.has("AvisAppelOffres")).toBe(false);
  });

  it("A ne voit aucune donnée de B en liste, comptage ou agrégat", async () => {
    const dbA = tenantDb(base, A);
    expect(await dbA.dossier.findMany()).toHaveLength(0);
    expect(await dbA.compte.count()).toBe(0);
    expect((await dbA.dossier.aggregate({ _sum: { estimation: true } }))._sum.estimation).toBeNull();
  });

  it("A ne peut pas lire un objet de B par son identifiant", async () => {
    const dbA = tenantDb(base, A);
    expect(await dbA.dossier.findUnique({ where: { id: dossierB } })).toBeNull();
    expect(await dbA.dossier.findFirst({ where: { id: dossierB } })).toBeNull();
    // Tenter de forcer le tenantId dans le filtre ne change rien : la session l'emporte
    expect(await dbA.dossier.findFirst({ where: { id: dossierB, tenantId: B } })).toBeNull();
  });

  it("A ne peut ni modifier ni supprimer un objet de B", async () => {
    const dbA = tenantDb(base, A);
    await expect(dbA.dossier.update({ where: { id: dossierB }, data: { titre: "piraté" } })).rejects.toThrow();
    expect((await dbA.dossier.updateMany({ where: { id: dossierB }, data: { titre: "piraté" } })).count).toBe(0);
    await expect(dbA.dossier.delete({ where: { id: dossierB } })).rejects.toThrow();
    expect((await dbA.dossier.deleteMany({})).count).toBe(0);
    const intact = await base.dossier.findUnique({ where: { id: dossierB } });
    expect(intact?.titre).toBe("AO confidentiel de B");
  });

  it("A ne peut pas créer une donnée au nom de B", async () => {
    const dbA = tenantDb(base, A);
    const cree = await dbA.compte.create({ data: { nom: "Tentative", tenantId: B } });
    expect(cree.tenantId).toBe(A);
  });

  it("A ne peut pas déplacer une donnée vers un autre cabinet", async () => {
    const dbA = tenantDb(base, A);
    const c = await dbA.compte.create({ data: { tenantId: A, nom: "À moi" } });
    await expect(dbA.compte.update({ where: { id: c.id }, data: { tenantId: B } })).rejects.toThrow(/interdit/);
  });
});
