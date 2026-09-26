import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  enregistrerSimulation,
  historiqueDuCabinet,
  importerHistorique,
  QuotaSimulationsAtteint,
  resumeHistorique,
  supprimerHistorique,
  supprimerSimulation,
  type ParametresSimulation,
} from "@/lib/chiffrer/service";
import { tenantDb } from "@/lib/tenant";

const base = new PrismaClient();
let tenantId: string;
let autre: string;
let dossierId: string;
let dossierAutre: string;

const params = (p: Partial<ParametresSimulation> = {}): ParametresSimulation => ({
  type: "travaux",
  estimation: 2_000_000,
  modele: { nombreConcurrents: { min: 4, max: 8 }, distribution: { type: "normale", moyenne: 0.95, ecartType: 0.08 } },
  ...p,
});

describe.skipIf(!process.env.DATABASE_URL)("chiffrage enregistré", () => {
  beforeAll(async () => {
    tenantId = (await base.tenant.create({ data: { nom: "Chiffrage SA" } })).id;
    autre = (await base.tenant.create({ data: { nom: "Autre SA" } })).id;
    await base.abonnement.create({ data: { tenantId, palier: "GRATUIT" } });
    dossierId = (await base.dossier.create({ data: { tenantId, titre: "AO test" } })).id;
    dossierAutre = (await base.dossier.create({ data: { tenantId: autre, titre: "AO d'un autre" } })).id;
  });

  afterAll(async () => {
    await base.tenant.deleteMany({ where: { id: { in: [tenantId, autre] } } });
    await base.$disconnect();
  });

  it("recalcule côté serveur et rattache au dossier", async () => {
    const db = tenantDb(base, tenantId);
    const s = await enregistrerSimulation({ db, tenantId, userId: "u", parametres: params({ dossierId, cout: 1_700_000 }) });
    expect(s.dossierId).toBe(dossierId);
    expect(Number(s.prixRecommande)).toBeGreaterThanOrEqual(1_600_000);
    expect(Number(s.prixRecommande)).toBeLessThanOrEqual(2_400_000);
    expect(s.probabiliteGain).toBeGreaterThan(0);
    // Reproductible : même paramètres, même recommandation
    const s2 = await enregistrerSimulation({ db, tenantId, userId: "u", parametres: params({ dossierId, cout: 1_700_000 }) });
    expect(Number(s2.prixRecommande)).toBe(Number(s.prixRecommande));
    expect(await db.auditLog.count({ where: { action: "simulation.creation" } })).toBe(2);
  });

  it("refuse de rattacher une simulation au dossier d'un autre cabinet", async () => {
    await expect(
      enregistrerSimulation({ db: tenantDb(base, tenantId), tenantId, userId: "u", parametres: params({ dossierId: dossierAutre }) }),
    ).rejects.toThrow(/introuvable/);
  });

  it("rejette des paramètres invalides", async () => {
    await expect(
      enregistrerSimulation({ db: tenantDb(base, tenantId), tenantId, userId: "u", parametres: params({ estimation: -5 }) }),
    ).rejects.toThrow();
  });

  it("applique le quota de l'offre gratuite (3), suppression comprise", async () => {
    const db = tenantDb(base, tenantId);
    const s = await enregistrerSimulation({ db, tenantId, userId: "u", parametres: params() });
    await supprimerSimulation({ db, tenantId, userId: "u", simulationId: s.id });
    await expect(enregistrerSimulation({ db, tenantId, userId: "u", parametres: params() })).rejects.toBeInstanceOf(QuotaSimulationsAtteint);
  });

  it("importe, résume et supprime l'historique du cabinet", async () => {
    const db = tenantDb(base, tenantId);
    const imp = await importerHistorique({
      db,
      tenantId,
      userId: "u",
      nom: "AO 2025",
      lignes: [
        { typeMarche: "travaux", estimation: 1000, offres: [900, 950] },
        { typeMarche: "fournitures", estimation: 500, offres: [480] },
      ],
    });
    const lignes = await historiqueDuCabinet(db);
    expect(lignes).toHaveLength(2);
    expect(resumeHistorique(lignes)).toMatchObject({ travaux: { ao: 1, offres: 2 }, fournitures: { ao: 1, offres: 1 }, services: null });
    expect(await historiqueDuCabinet(tenantDb(base, autre))).toHaveLength(0);
    await supprimerHistorique({ db, tenantId, userId: "u", importId: imp.id });
    expect(await historiqueDuCabinet(db)).toHaveLength(0);
  });
});
