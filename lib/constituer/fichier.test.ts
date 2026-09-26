import { describe, expect, it } from "vitest";
import { FichierRefuse, nomSur, TAILLE_MAX, verifierFichier } from "./fichier";

const octets = (...o: number[]) => new Uint8Array([...o, 0, 0, 0, 0]).buffer;
const PDF = octets(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);

describe("fichiers du coffre-fort", () => {
  it("reconnaît PDF, PNG et JPEG à leur signature", () => {
    expect(verifierFichier("att.pdf", PDF).type).toBe("application/pdf");
    expect(verifierFichier("scan.png", octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).type).toBe("image/png");
    expect(verifierFichier("photo.jpeg", octets(0xff, 0xd8, 0xff, 0xe0)).type).toBe("image/jpeg");
  });

  it("refuse un fichier déguisé, vide ou trop lourd", () => {
    expect(() => verifierFichier("faux.pdf", new TextEncoder().encode("<html><script>").buffer)).toThrow(FichierRefuse);
    expect(() => verifierFichier("vide.pdf", new ArrayBuffer(0))).toThrow("vide");
    const lourd = new Uint8Array(TAILLE_MAX + 1);
    lourd.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(() => verifierFichier("gros.pdf", lourd.buffer)).toThrow("4 Mo");
  });

  it("produit un nom sûr, avec l'extension du type réel", () => {
    expect(nomSur('Attestation fiscale "2026"/../x.exe', "pdf")).toBe("Attestation-fiscale-2026-x.pdf");
    expect(nomSur("Récépissé été.PDF", "pdf")).toBe("Recepisse-ete.pdf");
    expect(nomSur("???", "png")).toBe("piece.png");
    expect(verifierFichier("image.gif", PDF).nom).toBe("image.pdf");
  });
});
