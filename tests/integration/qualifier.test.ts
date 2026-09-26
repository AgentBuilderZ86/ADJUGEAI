/**
 * Parcours de qualification sur base réelle, avec une analyse simulée (aucun appel à l'API Claude).
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AnalyseAo } from "@/lib/qualifier/analyse";
import { corrigerVerdict, qualifierAo, QuotaAtteint } from "@/lib/qualifier/service";
import { tenantDb } from "@/lib/tenant";

const base = new PrismaClient();
let tenantId: string;
let autreTenant: string;

const bloc = (note: number) => ({ note, justification: "test" });
const ks = (actif: boolean) => ({ actif, justification: "test" });

function analyseFictive(notes: number, killRefs = false): AnalyseAo {
  return {
    fiche: {
      objet: "Réhabilitation du siège provincial",
      acheteur: "Province de Test",
      reference: "01/2026",
      typeMarche: "TRAVAUX",
      estimationMad: 2_400_000,
      cautionProvisoireMad: 24_000,
      dateLimite: "2026-10-20 10:00",
      delaiExecution: "8 mois",
      lieu: "Test",
    },
    resume: "Travaux de réhabilitation.",
    criteresEliminatoires: ["Qualification 2 classe 3"],
    referencesExigees: [],
    qualificationsExigees: [],
    risquesContractuels: [],
    blocs: {
      alignement: bloc(notes),
      positionnement: bloc(notes),
      references: bloc(notes),
      competences: bloc(notes),
      economie: bloc(notes),
      risques: bloc(notes),
    },
    killSwitches: { referencesEliminatoiresNonCouvertes: ks(killRefs), budgetInsuffisant: ks(false), tropEditeur: ks(false) },
    pointsForts: [],
    pointsVigilance: [],
    questionsAcheteur: [],
    informationsManquantes: [],
  };
}

describe.skipIf(!process.env.DATABASE_URL)("qualification d'un AO", () => {
  beforeAll(async () => {
    tenantId = (await base.tenant.create({ data: { nom: "PME Test", profil: { metiers: "Gros œuvre" } } })).id;
    autreTenant = (await base.tenant.create({ data: { nom: "Autre" } })).id;
    await base.abonnement.create({ data: { tenantId, palier: "GRATUIT" } });
  });

  afterAll(async () => {
    await base.tenant.deleteMany({ where: { id: { in: [tenantId, autreTenant] } } });
    await base.$disconnect();
  });

  it("enregistre dossier, qualification et audit, avec le verdict calculé par la grille", async () => {
    const db = tenantDb(base, tenantId);
    let profilTransmis: unknown;
    const { dossier, qualification } = await qualifierAo({
      db,
      tenantId,
      userId: "u1",
      entree: { texte: "CPS…" },
      analyser: async (e) => {
        profilTransmis = e.profil;
        return analyseFictive(8);
      },
    });
    expect(profilTransmis).toMatchObject({ metiers: "Gros œuvre" });
    expect(qualification).toMatchObject({ scoreTotal: 80, verdict: "GO", tenantId });
    expect(dossier).toMatchObject({ statut: "GO", typeMarche: "TRAVAUX", titre: "Réhabilitation du siège provincial" });
    expect(Number(dossier.estimation)).toBe(2_400_000);
    expect(await db.auditLog.count({ where: { action: "qualification.creation" } })).toBe(1);
    // Invisible depuis un autre cabinet
    expect(await tenantDb(base, autreTenant).qualification.count()).toBe(0);
  });

  it("applique le kill switch des références éliminatoires", async () => {
    const { qualification, dossier } = await qualifierAo({
      db: tenantDb(base, tenantId),
      tenantId,
      userId: "u1",
      entree: { texte: "CPS…" },
      analyser: async () => analyseFictive(9, true),
    });
    expect(qualification.verdict).toBe("NO_GO");
    expect(qualification.killSwitch).toBe("referencesEliminatoiresNonCouvertes");
    expect(dossier.statut).toBe("NO_GO");
  });

  it("trace la correction manuelle d'un verdict", async () => {
    const db = tenantDb(base, tenantId);
    const q = await db.qualification.findFirst({ where: { verdict: "NO_GO" } });
    await corrigerVerdict({ db, tenantId, userId: "u1", qualificationId: q!.id, verdict: "GO_CONDITIONNEL", commentaire: "Référence couverte par notre filiale" });
    const maj = await db.qualification.findUnique({ where: { id: q!.id } });
    expect(maj).toMatchObject({ verdict: "GO_CONDITIONNEL", corrige: true });
    expect(await db.feedbackRegle.findFirst({ where: { qualificationId: q!.id } })).toMatchObject({
      verdictInitial: "NO_GO",
      verdictCorrige: "GO_CONDITIONNEL",
    });
    expect((await db.dossier.findUnique({ where: { id: q!.dossierId } }))?.statut).toBe("GO_CONDITIONNEL");
  });

  it("refuse la correction d'une qualification d'un autre cabinet", async () => {
    const q = await tenantDb(base, tenantId).qualification.findFirst();
    await expect(
      corrigerVerdict({ db: tenantDb(base, autreTenant), tenantId: autreTenant, userId: "x", qualificationId: q!.id, verdict: "GO", commentaire: "" }),
    ).rejects.toThrow(/introuvable/);
  });

  it("bloque au-delà du quota mensuel de l'offre gratuite (3)", async () => {
    const db = tenantDb(base, tenantId);
    await qualifierAo({ db, tenantId, userId: "u1", entree: { texte: "x" }, analyser: async () => analyseFictive(5) });
    let appele = false;
    await expect(
      qualifierAo({
        db,
        tenantId,
        userId: "u1",
        entree: { texte: "x" },
        analyser: async () => {
          appele = true;
          return analyseFictive(5);
        },
      }),
    ).rejects.toBeInstanceOf(QuotaAtteint);
    expect(appele).toBe(false); // aucun appel payant à l'API une fois le quota atteint
  });
});
