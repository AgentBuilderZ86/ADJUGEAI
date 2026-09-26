import { describe, expect, it } from "vitest";
import { lireListeTermes, normaliser, pertinence, typeDepuisCategorie, type CriteresVeille } from "./correspondance";

const criteres = (c: Partial<CriteresVeille> = {}): CriteresVeille => ({
  motsCles: [],
  exclusions: [],
  regions: [],
  typesMarche: [],
  estimationMin: null,
  estimationMax: null,
  ...c,
});

const avis = {
  objet: "Travaux d'aménagement et de réhabilitation du centre de santé",
  acheteur: "Préfecture d'arrondissements Ain Chock",
  lieu: "CASABLANCA",
  typeMarche: "TRAVAUX" as const,
  estimation: 3_450_000,
};

describe("normaliser", () => {
  it("retire accents, casse et ponctuation", () => {
    expect(normaliser("Étude d'IMPACT — Rabat-Salé")).toBe("etude d impact rabat sale");
  });
});

describe("pertinence", () => {
  it("compte les mots-clés trouvés (début de mot, sans accents)", () => {
    expect(pertinence(avis, criteres({ motsCles: ["amenagement", "sante", "voirie"] }))).toBe(2);
    expect(pertinence(avis, criteres({ motsCles: ["réhabilit"] }))).toBe(1);
    expect(pertinence(avis, criteres({ motsCles: ["voirie"] }))).toBeNull();
  });

  it("n'accepte pas un mot-clé au milieu d'un mot", () => {
    expect(pertinence(avis, criteres({ motsCles: ["habilitation"] }))).toBeNull();
  });

  it("applique exclusions, types, régions et fourchette d'estimation", () => {
    expect(pertinence(avis, criteres({ exclusions: ["santé"] }))).toBeNull();
    expect(pertinence(avis, criteres({ typesMarche: ["FOURNITURES"] }))).toBeNull();
    expect(pertinence(avis, criteres({ regions: ["Rabat"] }))).toBeNull();
    expect(pertinence(avis, criteres({ regions: ["casablanca", "rabat"] }))).toBe(0);
    expect(pertinence(avis, criteres({ estimationMin: 5_000_000 }))).toBeNull();
    expect(pertinence(avis, criteres({ estimationMax: 3_000_000 }))).toBeNull();
    expect(pertinence(avis, criteres({ estimationMin: 1_000_000, estimationMax: 5_000_000 }))).toBe(0);
  });

  it("n'écarte pas un avis pour une information inconnue", () => {
    const inconnu = { ...avis, lieu: null, typeMarche: null, estimation: null };
    expect(pertinence(inconnu, criteres({ regions: ["Rabat"], typesMarche: ["SERVICES"], estimationMin: 9e9 }))).toBe(0);
  });
});

describe("typeDepuisCategorie", () => {
  it("distingue les études parmi les services", () => {
    expect(typeDepuisCategorie("Travaux")).toBe("TRAVAUX");
    expect(typeDepuisCategorie("Fournitures")).toBe("FOURNITURES");
    expect(typeDepuisCategorie("Services", "Nettoyage des locaux")).toBe("SERVICES");
    expect(typeDepuisCategorie("Services", "Étude et assistance technique pour le schéma directeur")).toBe("ETUDES");
    expect(typeDepuisCategorie(null)).toBeNull();
  });
});

describe("lireListeTermes", () => {
  it("découpe sur virgules, points-virgules et lignes, sans doublons", () => {
    expect(lireListeTermes("voirie, assainissement ;\nvoirie\n\n bâtiment ")).toEqual(["voirie", "assainissement", "bâtiment"]);
  });
});
