import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";

/** Stockage de fichiers clé → octets. Netlify Blobs en production, disque local en développement. */
export interface Stockage {
  ecrire(cle: string, octets: ArrayBuffer): Promise<void>;
  lire(cle: string): Promise<ArrayBuffer | null>;
  supprimer(cle: string): Promise<void>;
}

export class StockageIndisponible extends Error {}

const MAGASIN = "coffre-fort";

function blobsDisponibles() {
  return Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT);
}

export function stockageBlobs(): Stockage {
  const magasin = () => getStore({ name: MAGASIN, consistency: "strong" });
  return {
    ecrire: async (cle, octets) => {
      await magasin().set(cle, octets);
    },
    lire: async (cle) => (await magasin().get(cle, { type: "arrayBuffer" })) ?? null,
    supprimer: async (cle) => {
      await magasin().delete(cle);
    },
  };
}

/** Clés de la forme cabinet/pièce/uuid : jamais de « .. » ni de chemin absolu. */
function cheminSur(racine: string, cle: string) {
  if (!/^[\w-]+(\/[\w-]+)*$/.test(cle)) throw new Error("Clé de stockage invalide.");
  return path.join(racine, ...cle.split("/"));
}

export function stockageDisque(racine: string): Stockage {
  return {
    ecrire: async (cle, octets) => {
      const f = cheminSur(racine, cle);
      await mkdir(path.dirname(f), { recursive: true });
      await writeFile(f, Buffer.from(octets));
    },
    lire: async (cle) => {
      try {
        const b = await readFile(cheminSur(racine, cle));
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    supprimer: async (cle) => {
      await rm(cheminSur(racine, cle), { force: true });
    },
  };
}

export function stockageMemoire(): Stockage & { cles(): string[] } {
  const m = new Map<string, ArrayBuffer>();
  return {
    ecrire: async (cle, octets) => void m.set(cle, octets.slice(0)),
    lire: async (cle) => m.get(cle) ?? null,
    supprimer: async (cle) => void m.delete(cle),
    cles: () => [...m.keys()],
  };
}

/** Stockage de l'environnement courant. */
export function stockage(): Stockage {
  if (blobsDisponibles()) return stockageBlobs();
  if (process.env.NODE_ENV !== "production" || process.env.ADJUGE_STOCKAGE_LOCAL) {
    return stockageDisque(process.env.ADJUGE_STOCKAGE_LOCAL || path.join(process.cwd(), ".stockage"));
  }
  throw new StockageIndisponible("Le stockage des fichiers n'est pas disponible sur cet environnement.");
}
