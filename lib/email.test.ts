import { describe, expect, it } from "vitest";
import { echapperHtml, emailConfigure, envoyerEmail } from "./email";

const email = { a: ["a@exemple.ma"], sujet: "S", html: "<p>h</p>", texte: "t" };

describe("envoyerEmail", () => {
  it("n'envoie rien sans configuration", async () => {
    expect(emailConfigure({})).toBe(false);
    expect(await envoyerEmail(email, {})).toEqual({ envoye: false, raison: "e-mail non configuré" });
  });

  it("appelle Resend avec la clé et l'expéditeur", async () => {
    let requete: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      requete = { url, init };
      return Response.json({ id: "em_1" });
    }) as unknown as typeof fetch;
    const r = await envoyerEmail(email, { cle: "re_x", expediteur: "Adjugé <alertes@exemple.ma>", fetch: f });
    expect(r).toEqual({ envoye: true, id: "em_1" });
    expect(requete?.url).toBe("https://api.resend.com/emails");
    expect((requete?.init.headers as Record<string, string>).authorization).toBe("Bearer re_x");
    expect(JSON.parse(String(requete?.init.body))).toMatchObject({ from: "Adjugé <alertes@exemple.ma>", to: ["a@exemple.ma"], subject: "S" });
  });

  it("remonte l'erreur du fournisseur", async () => {
    const f = (async () => Response.json({ message: "domain not verified" }, { status: 403 })) as unknown as typeof fetch;
    expect(await envoyerEmail(email, { cle: "k", expediteur: "e", fetch: f })).toEqual({ envoye: false, raison: "Resend 403 : domain not verified" });
  });

  it("échappe le HTML", () => {
    expect(echapperHtml(`<a href="x">L'été & co</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;L&#39;été &amp; co&lt;/a&gt;");
  });
});
