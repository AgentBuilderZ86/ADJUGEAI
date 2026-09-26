import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ajouterExigence,
  coffreFort,
  dossiersEnConstitution,
  enregistrerPiece,
  joindreFichier,
  listeDuDossier,
  lireFichier,
  modifierExigence,
  preparerListe,
  supprimerPiece,
} from "@/lib/constituer/service";
import { tenantDb } from "@/lib/tenant";
import { stockageMemoire } from "@/lib/stockage";

const base = new PrismaClient();
let A: string;
let B: string;
let userA: string;
let dossierId: string;
const maintenant = new Date("2030-05-10T09:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe.skipIf(!process.env.DATABASE_URL)("constituer", () => {
  beforeAll(async () => {
    A = (await base.tenant.create({ data: { nom: "Constituer A" } })).id;
    B = (await base.tenant.create({ data: { nom: "Constituer B" } })).id;
    userA = (await base.user.create({ data: { tenantId: A, email: "a@constituer.test", nom: "A", motDePasse: "x", role: "OWNER" } })).id;
    dossierId = (
      await base.dossier.create({ data: { tenantId: A, titre: "Voirie", typeMarche: "TRAVAUX", statut: "GO", dateDepot: d("2030-06-15") } })
    ).id;
    await base.qualification.create({
      data: {
        tenantId: A,
        dossierId,
        scoreTotal: 80,
        scoreParBloc: {},
        verdict: "GO",
        motifs: {},
        syntheseIa: {
          fiche: { cautionProvisoireMad: 20000 },
          qualificationsExigees: ["Certificat de qualification secteur A, classe 3"],
          referencesExigees: ["2 attestations de travaux de voirie de plus de 1 MDH"],
          criteresEliminatoires: ["Visite des lieux obligatoire"],
        },
      },
    });
  });

  afterAll(async () => {
    await base.tenant.deleteMany({ where: { id: { in: [A, B] } } });
    await base.$disconnect();
  });

  it("gère le coffre-fort et calcule les échéances", async () => {
    const db = tenantDb(base, A);
    await enregistrerPiece({ db, tenantId: A, userId: userA, donnees: { type: "ATTESTATION_FISCALE", delivreLe: d("2029-06-01"), expireLe: null } });
    await enregistrerPiece({ db, tenantId: A, userId: userA, donnees: { type: "ATTESTATION_CNSS", delivreLe: d("2029-12-01"), expireLe: null } });
    const pieces = await coffreFort(db, maintenant);
    expect(pieces.map((p) => [p.type, p.etat])).toEqual([
      ["ATTESTATION_FISCALE", "a-renouveler"],
      ["ATTESTATION_CNSS", "valide"],
    ]);
    expect(await coffreFort(tenantDb(base, B))).toEqual([]);
    await expect(
      enregistrerPiece({ db, tenantId: A, userId: userA, donnees: { type: "INCONNU", delivreLe: null, expireLe: null } }),
    ).rejects.toThrow();
  });

  it("prépare la liste depuis le décret et le RC analysé, une seule fois", async () => {
    const db = tenantDb(base, A);
    const n = await preparerListe({ db, tenantId: A, userId: userA, dossierId });
    expect(n).toBeGreaterThan(10);
    expect(await preparerListe({ db, tenantId: A, userId: userA, dossierId })).toBe(0);
    await expect(preparerListe({ db: tenantDb(base, B), tenantId: B, userId: userA, dossierId })).rejects.toThrow("introuvable");

    const liste = (await listeDuDossier(db, dossierId, maintenant))!;
    const par = (t: string) => liste.lignes.find((l) => l.libelle.includes(t))!;
    expect(par("cautionnement").eliminatoire).toBe(true);
    expect(par("classe 3").reference).toContain("à vérifier");
    expect(par("Visite des lieux").eliminatoire).toBe(true);
    expect(liste.lignes.some((l) => l.enveloppe === "offre-technique")).toBe(false); // travaux

    // Fiscale délivrée le 01/06/2029 : expirée à la date de dépôt du 15/06/2030 ; CNSS valable.
    expect(par("régularité fiscale").statut).toBe("EXPIREE");
    expect(par("CNSS").statut).toBe("PRETE");
    expect(par("CNSS").piece?.etat).toBe("valide");
  });

  it("suit l'avancement et les pièces éliminatoires", async () => {
    const db = tenantDb(base, A);
    const liste = (await listeDuDossier(db, dossierId, maintenant))!;
    const visite = liste.lignes.find((l) => l.libelle.includes("Visite"))!;
    await modifierExigence({ db, id: visite.id, statut: "PRETE", responsable: "  Karim  " });
    const apres = (await listeDuDossier(db, dossierId, maintenant))!;
    expect(apres.lignes.find((l) => l.id === visite.id)).toMatchObject({ statut: "PRETE", responsable: "Karim" });
    expect(apres.avancement.pretes).toBe(liste.avancement.pretes + 1);
    expect(apres.avancement.bloquantes).toBe(liste.avancement.bloquantes - 1);

    await ajouterExigence({ db, tenantId: A, dossierId, donnees: { enveloppe: "autre", libelle: "Échantillons", eliminatoire: false } });
    expect((await listeDuDossier(db, dossierId, maintenant))!.lignes.at(-1)?.libelle).toBe("Échantillons");

    const [resume] = await dossiersEnConstitution(db, maintenant);
    expect(resume).toMatchObject({ id: dossierId, total: apres.avancement.total + 1, pretes: apres.avancement.pretes });

    await expect(modifierExigence({ db: tenantDb(base, B), id: visite.id, statut: "MANQUANTE" })).rejects.toThrow("introuvable");
  });

  it("joint, remplace et sert le fichier d'une pièce, au seul cabinet", async () => {
    const db = tenantDb(base, A);
    const s = stockageMemoire();
    const piece = await enregistrerPiece({ db, tenantId: A, userId: userA, donnees: { type: "REGISTRE_COMMERCE", delivreLe: null, expireLe: null } });
    const pdf = (t: string) => new TextEncoder().encode(`%PDF-1.7 ${t}`).buffer;

    const f = await joindreFichier({ db, tenantId: A, userId: userA, pieceId: piece.id, fichier: { nom: "Modèle 9.pdf", octets: pdf("v1") }, stockage: s });
    expect(f).toMatchObject({ type: "application/pdf", nom: "Modele-9.pdf" });
    expect(s.cles()).toHaveLength(1);
    expect(s.cles()[0].startsWith(`${A}/${piece.id}/`)).toBe(true);

    await joindreFichier({ db, tenantId: A, userId: userA, pieceId: piece.id, fichier: { nom: "v2.pdf", octets: pdf("v2") }, stockage: s });
    expect(s.cles()).toHaveLength(1); // l'ancien fichier est effacé
    const lu = await lireFichier(db, piece.id, s);
    expect(new TextDecoder().decode(lu!.octets)).toBe("%PDF-1.7 v2");
    expect((await coffreFort(db, maintenant)).find((p) => p.id === piece.id)?.fichier).toMatchObject({ nom: "v2.pdf" });

    // Un autre cabinet ne peut ni lire ni remplacer le fichier.
    expect(await lireFichier(tenantDb(base, B), piece.id, s)).toBeNull();
    await expect(
      joindreFichier({ db: tenantDb(base, B), tenantId: B, userId: userA, pieceId: piece.id, fichier: { nom: "x.pdf", octets: pdf("x") }, stockage: s }),
    ).rejects.toThrow("introuvable");

    // Un faux PDF est refusé et rien n'est écrit.
    await expect(
      joindreFichier({ db, tenantId: A, userId: userA, pieceId: piece.id, fichier: { nom: "x.pdf", octets: new TextEncoder().encode("<html>").buffer }, stockage: s }),
    ).rejects.toThrow("Format non accepté");
    expect(s.cles()).toHaveLength(1);

    await supprimerPiece({ db, tenantId: A, userId: userA, pieceId: piece.id, stockage: s });
    expect(s.cles()).toHaveLength(0);
  });

  it("détache la pièce supprimée des listes", async () => {
    const db = tenantDb(base, A);
    const cnss = (await coffreFort(db, maintenant)).find((p) => p.type === "ATTESTATION_CNSS")!;
    await supprimerPiece({ db, tenantId: A, userId: userA, pieceId: cnss.id, stockage: stockageMemoire() });
    const liste = (await listeDuDossier(db, dossierId, maintenant))!;
    expect(liste.lignes.find((l) => l.libelle.includes("CNSS"))).toMatchObject({ piece: null, statut: "MANQUANTE" });
  });
});
