import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Adjugé — le prix qui gagne les marchés publics", template: "%s · Adjugé" },
  description:
    "Veille, qualification, chiffrage réglementaire (décret 2-22-431), constitution du dossier, exécution et encaissement des marchés publics au Maroc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
