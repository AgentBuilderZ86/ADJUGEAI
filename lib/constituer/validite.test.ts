import { describe, expect, it } from "vitest";
import { exigencesDeBase, TYPES_PIECE } from "./catalogue";
import { echeance, etatA, meilleurePiece } from "./validite";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("validité des pièces", () => {
  it("déduit un an de validité pour les attestations fiscale et CNSS (art. 28)", () => {
    expect(echeance({ type: "ATTESTATION_FISCALE", delivreLe: d("2026-03-15"), expireLe: null })).toEqual(d("2027-03-15"));
    expect(echeance({ type: "ATTESTATION_CNSS", delivreLe: d("2026-01-31"), expireLe: null })?.getUTCFullYear()).toBe(2027);
  });

  it("n'invente pas d'échéance quand le décret n'en fixe pas", () => {
    expect(echeance({ type: "REGISTRE_COMMERCE", delivreLe: d("2026-03-15"), expireLe: null })).toBeNull();
  });

  it("privilégie l'échéance saisie", () => {
    expect(echeance({ type: "ATTESTATION_FISCALE", delivreLe: d("2026-03-15"), expireLe: d("2026-12-31") })).toEqual(d("2026-12-31"));
  });

  it("classe l'état à une date donnée", () => {
    const p = { type: "AUTRE", delivreLe: null, expireLe: d("2026-10-20") };
    expect(etatA(p, d("2026-09-01"))).toBe("valide");
    expect(etatA(p, d("2026-10-01"))).toBe("a-renouveler");
    expect(etatA(p, d("2026-10-20"))).toBe("expiree");
    expect(etatA({ type: "AUTRE", delivreLe: null, expireLe: null }, d("2026-10-01"))).toBe("sans-echeance");
  });

  it("retient la pièce valable le plus longtemps", () => {
    const a = { type: "ATTESTATION_CNSS", delivreLe: d("2025-10-01"), expireLe: null };
    const b = { type: "ATTESTATION_CNSS", delivreLe: d("2026-06-01"), expireLe: null };
    expect(meilleurePiece([a, b])).toBe(b);
    expect(meilleurePiece([])).toBeNull();
  });
});

describe("socle du dossier", () => {
  it("n'exige la caution et l'offre technique que si le dossier les prévoit", () => {
    const sans = exigencesDeBase({ caution: false, offreTechnique: false });
    const avec = exigencesDeBase({ caution: true, offreTechnique: true });
    expect(avec.length - sans.length).toBe(2);
    expect(sans.some((e) => e.libelle.includes("cautionnement"))).toBe(false);
  });

  it("ne rattache les exigences qu'à des types connus", () => {
    const cles = new Set(TYPES_PIECE.map((t) => t.cle));
    for (const e of exigencesDeBase({ caution: true, offreTechnique: true })) if (e.typePiece) expect(cles.has(e.typePiece)).toBe(true);
  });
});
