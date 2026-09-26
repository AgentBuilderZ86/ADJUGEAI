import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { stockageDisque } from "./stockage";

describe("stockage sur disque", async () => {
  const racine = await mkdtemp(path.join(tmpdir(), "adjuge-"));
  const s = stockageDisque(racine);
  afterAll(() => rm(racine, { recursive: true, force: true }));

  it("écrit, lit et supprime", async () => {
    await s.ecrire("cab1/piece1/abc-123", new TextEncoder().encode("%PDF-x").buffer);
    expect(new TextDecoder().decode((await s.lire("cab1/piece1/abc-123"))!)).toBe("%PDF-x");
    await s.supprimer("cab1/piece1/abc-123");
    expect(await s.lire("cab1/piece1/abc-123")).toBeNull();
    await s.supprimer("cab1/piece1/abc-123"); // idempotent
  });

  it("refuse les clés qui sortiraient du répertoire", async () => {
    for (const cle of ["../x", "/etc/passwd", "a/../../b", "a//b"]) await expect(s.lire(cle)).rejects.toThrow("invalide");
  });
});
