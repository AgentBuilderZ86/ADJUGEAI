import { describe, expect, it } from "vitest";
import { dateFr, dateHeureFr, heureFr } from "./dates";

describe("dates à l'heure du Maroc", () => {
  it("convertit l'UTC du serveur en heure de Casablanca (UTC+1)", () => {
    const d = new Date("2026-09-26T17:02:15Z");
    expect(heureFr(d)).toBe("18:02");
    expect(dateHeureFr(d)).toBe("26/09/2026 18:02");
    expect(dateFr(new Date("2026-09-26T23:30:00Z"))).toBe("27/09/2026");
    expect(dateFr(null)).toBe("—");
  });
});
