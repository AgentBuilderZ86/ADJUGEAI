"use client";

import { Button } from "@/components/ui/button";

export function BoutonImprimer() {
  return (
    <Button variante="secondaire" onClick={() => window.print()}>
      Imprimer / PDF
    </Button>
  );
}
