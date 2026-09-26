"use client";

import "./globals.css";
import { ErreurApplication } from "@/components/erreur-application";

/** Dernier filet : erreur dans le layout racine lui-même. */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <ErreurApplication {...props} />
      </body>
    </html>
  );
}
