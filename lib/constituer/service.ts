import type { StatutPiece } from "@prisma/client";
import { z } from "zod";
import type { TenantDb } from "@/lib/tenant";
import { ENVELOPPES, exigencesDeBase, REFERENCE_DECRET, TYPE_PAR_CLE, type CleEnveloppe } from "./catalogue";
import { echeance, etatA, meilleurePiece, type EtatValidite } from "./validite";

// ───────────────────────────── Coffre-fort ─────────────────────────────

export const schemaPiece = z
  .object({
    type: z.string().refine((t) => TYPE_PAR_CLE.has(t), "Type de pièce inconnu."),
    libelle: z.string().trim().max(200).optional(),
    numero: z.string().trim().max(100).optional(),
    delivreLe: z.date().nullable(),
    expireLe: z.date().nullable(),
  })
  .refine((p) => !p.delivreLe || !p.expireLe || p.expireLe > p.delivreLe, { message: "L'échéance doit suivre la date de délivrance.", path: ["expireLe"] });

export type DonneesPiece = z.infer<typeof schemaPiece>;

export async function enregistrerPiece(params: { db: TenantDb; tenantId: string; userId: string; donnees: DonneesPiece }) {
  const { db, tenantId, userId } = params;
  const d = schemaPiece.parse(params.donnees);
  const libelle = d.libelle || TYPE_PAR_CLE.get(d.type)!.libelle;
  return db.$transaction(async (tx) => {
    const piece = await tx.pieceEntreprise.create({
      data: { tenantId, type: d.type, libelle, numero: d.numero || null, delivreLe: d.delivreLe, expireLe: d.expireLe },
    });
    await tx.auditLog.create({
      data: { tenantId, userId, action: "piece.ajout", cible: `PieceEntreprise:${piece.id}`, apres: { type: d.type, libelle, expireLe: echeance(piece) } },
    });
    return piece;
  });
}

export async function supprimerPiece(params: { db: TenantDb; tenantId: string; userId: string; pieceId: string }) {
  const { db, tenantId, userId, pieceId } = params;
  const p = await db.pieceEntreprise.findUnique({ where: { id: pieceId } });
  if (!p) throw new Error("Pièce introuvable.");
  await db.$transaction([
    db.pieceRequise.updateMany({ where: { pieceId: p.id }, data: { pieceId: null } }),
    db.pieceEntreprise.delete({ where: { id: p.id } }),
    db.auditLog.create({ data: { tenantId, userId, action: "piece.suppression", cible: `PieceEntreprise:${p.id}`, avant: { type: p.type, libelle: p.libelle } } }),
  ]);
}

export interface PieceCoffre {
  id: string;
  type: string;
  libelle: string;
  numero: string | null;
  delivreLe: Date | null;
  expireLe: Date | null;
  echeance: Date | null;
  etat: EtatValidite;
}

/** Pièces du cabinet avec leur état à ce jour, les plus urgentes d'abord. */
export async function coffreFort(db: TenantDb, maintenant = new Date()): Promise<PieceCoffre[]> {
  const pieces = await db.pieceEntreprise.findMany({ orderBy: { createdAt: "desc" } });
  const rang: Record<EtatValidite, number> = { expiree: 0, "a-renouveler": 1, valide: 2, "sans-echeance": 3 };
  return pieces
    .map((p) => ({ id: p.id, type: p.type, libelle: p.libelle, numero: p.numero, delivreLe: p.delivreLe, expireLe: p.expireLe, echeance: echeance(p), etat: etatA(p, maintenant) }))
    .sort((a, b) => rang[a.etat] - rang[b.etat] || (a.echeance?.getTime() ?? Infinity) - (b.echeance?.getTime() ?? Infinity));
}

// ───────────────────────────── Liste des pièces d'un dossier ─────────────────────────────

interface SyntheseRc {
  fiche?: { cautionProvisoireMad?: number | null };
  criteresEliminatoires?: string[];
  referencesExigees?: string[];
  qualificationsExigees?: string[];
}

function typeDepuisLibelle(libelle: string): string | undefined {
  if (/agr[ée]ment/i.test(libelle)) return "AGREMENT";
  if (/qualification|classification|classe\s/i.test(libelle)) return "CERTIFICAT_QUALIFICATION";
  return undefined;
}

/**
 * Crée la liste des pièces du dossier : socle du décret, puis exigences propres au RC lues par
 * la qualification (à vérifier). Sans effet si la liste existe déjà.
 */
export async function preparerListe(params: { db: TenantDb; tenantId: string; userId: string; dossierId: string }) {
  const { db, tenantId, userId, dossierId } = params;
  const dossier = await db.dossier.findUnique({
    where: { id: dossierId },
    include: { avis: { select: { cautionProvisoire: true } }, qualifications: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { piecesRequises: true } } },
  });
  if (!dossier) throw new Error("Dossier introuvable.");
  if (dossier._count.piecesRequises > 0) return 0;

  const s = (dossier.qualifications[0]?.syntheseIa ?? {}) as SyntheseRc;
  const caution = Number(dossier.avis?.cautionProvisoire ?? 0) > 0 || Number(s.fiche?.cautionProvisoireMad ?? 0) > 0;
  const lignes: { enveloppe: CleEnveloppe; libelle: string; reference: string; typePiece?: string; eliminatoire?: boolean }[] = [
    ...exigencesDeBase({ caution, offreTechnique: dossier.typeMarche === "ETUDES" }).map((e) => ({ ...e, reference: `${REFERENCE_DECRET}, ${e.reference}` })),
    ...(s.qualificationsExigees ?? []).map((l) => ({ enveloppe: "technique" as const, libelle: l, reference: "RC (lu par l'analyse, à vérifier)", typePiece: typeDepuisLibelle(l) })),
    ...(s.referencesExigees ?? []).map((l) => ({ enveloppe: "technique" as const, libelle: l, reference: "RC (lu par l'analyse, à vérifier)", typePiece: "ATTESTATION_REFERENCE" })),
    ...(s.criteresEliminatoires ?? []).map((l) => ({ enveloppe: "autre" as const, libelle: l, reference: "RC (lu par l'analyse, à vérifier)", eliminatoire: true })),
  ];

  await db.$transaction([
    db.pieceRequise.createMany({
      data: lignes.map((l, i) => ({
        tenantId,
        dossierId,
        enveloppe: l.enveloppe,
        libelle: l.libelle.slice(0, 500),
        reference: l.reference,
        typePiece: l.typePiece ?? null,
        eliminatoire: l.eliminatoire ?? false,
        ordre: i,
      })),
    }),
    db.auditLog.create({ data: { tenantId, userId, action: "constituer.liste", cible: `Dossier:${dossierId}`, apres: { pieces: lignes.length } } }),
  ]);
  return lignes.length;
}

export const schemaExigence = z.object({
  enveloppe: z.enum(ENVELOPPES.map((e) => e.cle) as [CleEnveloppe, ...CleEnveloppe[]]),
  libelle: z.string().trim().min(3, "Libellé trop court.").max(500),
  eliminatoire: z.boolean(),
});

export async function ajouterExigence(params: { db: TenantDb; tenantId: string; dossierId: string; donnees: z.infer<typeof schemaExigence> }) {
  const { db, tenantId, dossierId } = params;
  const d = schemaExigence.parse(params.donnees);
  if (!(await db.dossier.findUnique({ where: { id: dossierId } }))) throw new Error("Dossier introuvable.");
  const dernier = await db.pieceRequise.findFirst({ where: { dossierId }, orderBy: { ordre: "desc" } });
  return db.pieceRequise.create({ data: { tenantId, dossierId, ...d, reference: "Ajout manuel", ordre: (dernier?.ordre ?? -1) + 1 } });
}

export async function modifierExigence(params: { db: TenantDb; id: string; statut?: StatutPiece; responsable?: string | null }) {
  const { db, id, statut, responsable } = params;
  const e = await db.pieceRequise.findUnique({ where: { id } });
  if (!e) throw new Error("Pièce introuvable.");
  return db.pieceRequise.update({
    where: { id },
    data: { ...(statut ? { statut } : {}), ...(responsable !== undefined ? { responsable: responsable?.trim().slice(0, 100) || null } : {}) },
  });
}

export async function supprimerExigence(params: { db: TenantDb; id: string }) {
  const e = await params.db.pieceRequise.findUnique({ where: { id: params.id } });
  if (!e) throw new Error("Pièce introuvable.");
  await params.db.pieceRequise.delete({ where: { id: e.id } });
}

export interface LigneListe {
  id: string;
  enveloppe: string;
  libelle: string;
  reference: string | null;
  eliminatoire: boolean;
  responsable: string | null;
  statutSaisi: StatutPiece;
  /** Statut retenu : celui du coffre-fort quand une pièce y correspond, sinon celui saisi */
  statut: StatutPiece;
  piece: { libelle: string; echeance: Date | null; etat: EtatValidite } | null;
}

type Exigence = { id: string; enveloppe: string; libelle: string; reference: string | null; eliminatoire: boolean; responsable: string | null; statut: StatutPiece; typePiece: string | null };
type PieceBrute = { type: string; libelle: string; delivreLe: Date | null; expireLe: Date | null };

function rapprocher(e: Exigence, coffre: PieceBrute[], dateReference: Date): LigneListe {
  const p = e.typePiece ? meilleurePiece(coffre.filter((c) => c.type === e.typePiece)) : null;
  const etat = p ? etatA(p, dateReference) : null;
  return {
    id: e.id,
    enveloppe: e.enveloppe,
    libelle: e.libelle,
    reference: e.reference,
    eliminatoire: e.eliminatoire,
    responsable: e.responsable,
    statutSaisi: e.statut,
    statut: p ? (etat === "expiree" ? "EXPIREE" : "PRETE") : e.statut,
    piece: p ? { libelle: p.libelle, echeance: echeance(p), etat: etat! } : null,
  };
}

/**
 * Liste du dossier, rapprochée du coffre-fort. La validité est évaluée à la date limite de dépôt
 * (à défaut aujourd'hui) ; le décret l'apprécie à la date de production au maître d'ouvrage, qui peut être postérieure.
 */
export async function listeDuDossier(db: TenantDb, dossierId: string, maintenant = new Date()) {
  const dossier = await db.dossier.findUnique({
    where: { id: dossierId },
    include: { avis: { select: { dateLimite: true } }, piecesRequises: { orderBy: { ordre: "asc" } } },
  });
  if (!dossier) return null;
  const dateReference = dossier.dateDepot ?? dossier.avis?.dateLimite ?? maintenant;
  const coffre = await db.pieceEntreprise.findMany();

  const lignes = dossier.piecesRequises.map((e) => rapprocher(e, coffre, dateReference));
  const pretes = lignes.filter((l) => l.statut === "PRETE").length;
  const bloquantes = lignes.filter((l) => l.eliminatoire && l.statut !== "PRETE").length;
  return { dossier, dateReference, dateReferenceConnue: dateReference !== maintenant, lignes, avancement: { pretes, total: lignes.length, bloquantes } };
}

/** Dossiers en cours de constitution (GO, GO conditionnel, en préparation) avec leur avancement. */
export async function dossiersEnConstitution(db: TenantDb, maintenant = new Date()) {
  const [dossiers, coffre] = await Promise.all([
    db.dossier.findMany({
      where: { statut: { in: ["GO", "GO_CONDITIONNEL", "EN_PREPARATION"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { avis: { select: { dateLimite: true } }, piecesRequises: true },
    }),
    db.pieceEntreprise.findMany(),
  ]);
  return dossiers.map((d) => {
    const dateLimite = d.dateDepot ?? d.avis?.dateLimite ?? null;
    const lignes = d.piecesRequises.map((e) => rapprocher(e, coffre, dateLimite ?? maintenant));
    return {
      id: d.id,
      titre: d.titre,
      acheteur: d.acheteur,
      statut: d.statut,
      dateLimite,
      total: lignes.length,
      pretes: lignes.filter((l) => l.statut === "PRETE").length,
      bloquantes: lignes.filter((l) => l.eliminatoire && l.statut !== "PRETE").length,
    };
  });
}
