"use client";

import { useEffect } from "react";

/** Réarme le rechargement automatique après un chargement réussi (voir ErreurApplication). */
export function ReinitialiserRechargement() {
  useEffect(() => {
    try {
      sessionStorage.removeItem("adjuge:rechargement-version");
    } catch {}
  }, []);
  return null;
}
