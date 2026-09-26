"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const CLE_RECHARGEMENT = "adjuge:rechargement-version";

/** Code chargé depuis un déploiement précédent (fichiers remplacés entre-temps). */
function estDecalageDeVersion(e: Error) {
  return e.name === "ChunkLoadError" || /Loading (CSS )?chunk|Failed to fetch dynamically imported module|Failed to find Server Action/i.test(e.message);
}

export function ErreurApplication({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const decalage = estDecalageDeVersion(error);

  useEffect(() => {
    console.error(error);
    if (!decalage) return;
    // Une nouvelle version a été déployée : un seul rechargement automatique, pour éviter toute boucle.
    try {
      if (sessionStorage.getItem(CLE_RECHARGEMENT)) return;
      sessionStorage.setItem(CLE_RECHARGEMENT, "1");
    } catch {
      return;
    }
    window.location.reload();
  }, [error, decalage]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">{decalage ? "Une nouvelle version d'Adjugé est disponible" : "Un problème est survenu"}</h1>
      <p className="mt-2 text-slate-600">
        {decalage ? "Rechargez la page pour continuer." : "Réessayez ; si le problème persiste, transmettez-nous la référence ci-dessous."}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => window.location.reload()}>Recharger</Button>
        {!decalage && (
          <Button variante="secondaire" onClick={reset}>
            Réessayer
          </Button>
        )}
      </div>
      <p className="mt-6 font-mono text-xs text-slate-400">
        Référence : {error.digest ?? error.name} — {error.message.slice(0, 120)}
      </p>
    </div>
  );
}
