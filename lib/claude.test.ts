import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ClaudeNonConfigure, messageErreurClaude } from "./claude";

const erreur = (status: number, message: string) =>
  Anthropic.APIError.generate(status, { type: "error", error: { type: "invalid_request_error", message } }, message, new Headers());

describe("messageErreurClaude", () => {
  it("explique un crédit insuffisant", () => {
    expect(messageErreurClaude(erreur(400, "Your credit balance is too low to access the Anthropic API."))).toMatch(/Crédit API Anthropic insuffisant/);
  });

  it("affiche le détail renvoyé par l'API pour une requête refusée", () => {
    const m = messageErreurClaude(erreur(400, "output_config.format.schema: invalid"));
    expect(m).toMatch(/Requête refusée/);
    expect(m).toContain("output_config.format.schema: invalid");
  });

  it("signale un modèle indisponible", () => {
    expect(messageErreurClaude(erreur(404, "model: claude-x not found"))).toMatch(/Modèle d'analyse indisponible/);
  });

  it("signale une clé invalide sans la divulguer", () => {
    expect(messageErreurClaude(erreur(401, "invalid x-api-key"))).toBe("Clé API Anthropic invalide : contactez l'administrateur.");
  });

  it("gère l'absence de clé", () => {
    expect(messageErreurClaude(new ClaudeNonConfigure())).toMatch(/pas encore activée/);
  });
});

describe("optionsClient", () => {
  it("ajoute l'en-tête de workspace si ANTHROPIC_WORKSPACE_ID est défini", async () => {
    const { optionsClient } = await import("./claude");
    expect(optionsClient({ ANTHROPIC_API_KEY: "k", ANTHROPIC_WORKSPACE_ID: " wrkspc_123 " }).defaultHeaders).toEqual({
      "anthropic-workspace-id": "wrkspc_123",
    });
    expect(optionsClient({ ANTHROPIC_API_KEY: "k" })).not.toHaveProperty("defaultHeaders");
  });

  it("explique une clé sans workspace", () => {
    const m = messageErreurClaude(
      erreur(400, "This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header"),
    );
    expect(m).toMatch(/ANTHROPIC_WORKSPACE_ID/);
  });
});
