import { describe, expect, it } from "vitest";
import { lireListeTermes, normaliser, pertinence, sansInstitutions, typeDepuisCategorie, type CriteresVeille } from "./correspondance";

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

  it("tolère pluriels, expressions et une faute de frappe", () => {
    const etude = { ...avis, objet: "Prestations intellectuelles : étude et assistance technique pour les routes rurales" };
    expect(pertinence(etude, criteres({ motsCles: ["prestations intelectuelles"] }))).toBe(1);
    expect(pertinence(etude, criteres({ motsCles: ["assistance technique"] }))).toBe(1);
    expect(pertinence(etude, criteres({ motsCles: ["intelectuel"] }))).toBe(1);
    expect(pertinence(etude, criteres({ motsCles: ["route"] }))).toBe(1);
    expect(pertinence(etude, criteres({ motsCles: ["études"] }))).toBe(1);
    // Pas de tolérance sur les mots courts (trop de faux positifs)
    expect(pertinence(etude, criteres({ motsCles: ["rote"] }))).toBeNull();
    expect(pertinence(etude, criteres({ motsCles: ["assistance juridique"] }))).toBeNull();
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

describe("institutions nommées « conseil »", () => {
  const conseil: CriteresVeille = { motsCles: ["conseil"], exclusions: [], regions: [], typesMarche: [], estimationMin: null, estimationMax: null };
  const avis = (objet: string, acheteur: string | null = null) => ({ objet, acheteur, lieu: null, typeMarche: null, estimation: null });

  it("ne confond pas une collectivité ou une institution avec du conseil", () => {
    expect(pertinence(avis("Acquisition de deux ambulances au profit du Conseil de la Province de Jerada"), conseil)).toBeNull();
    expect(pertinence(avis("Travaux de bitumage d'une route", "CONSEIL PROVINCIAL DE SIDI IFNI"), conseil)).toBeNull();
    expect(pertinence(avis("Achat de mobilier pour le Conseil National des Droits de l'Homme"), conseil)).toBeNull();
    expect(pertinence(avis("Fournitures pour le Conseil Économique, Social et Environnemental"), conseil)).toBeNull();
    expect(pertinence(avis("Hébergement des invités du conseil communal de Dakhla"), conseil)).toBeNull();
  });

  it("garde le conseil comme prestation, même chez une collectivité", () => {
    expect(pertinence(avis("Mission de conseil juridique", "Conseil Provincial de Taza"), conseil)).toBe(1);
    expect(pertinence(avis("Assistance technique à travers le conseil agricole privé"), conseil)).toBe(1);
    expect(pertinence(avis("Conseil en organisation au profit du conseil régional"), conseil)).toBe(1);
  });

  it("retire seulement le nom de l'institution", () => {
    expect(sansInstitutions(normaliser("Étude pour le Conseil de la Région Souss-Massa"))).toBe("etude pour le souss massa");
  });
});

describe("filtre par type de marché", () => {
  const profil = (typesMarche: CriteresVeille["typesMarche"]): CriteresVeille => ({
    motsCles: ["schéma directeur"], exclusions: [], regions: [], typesMarche, estimationMin: null, estimationMax: null,
  });
  const avis = (objet: string, typeMarche: "TRAVAUX" | "SERVICES" | "ETUDES" | "FOURNITURES") => ({ objet, acheteur: null, lieu: null, typeMarche, estimation: null });

  it("« Services » inclut les études", () => {
    expect(pertinence(avis("Etude du schéma directeur d'assainissement", "ETUDES"), profil(["SERVICES"]))).toBe(1);
  });

  it("« Études » reconnaît une étude rangée en travaux par le portail", () => {
    expect(pertinence(avis("Etude du schéma directeur des réseaux d'électricité", "TRAVAUX"), profil(["ETUDES"]))).toBe(1);
    expect(pertinence(avis("Création des départs HTA suivant le schéma directeur", "TRAVAUX"), profil(["ETUDES"]))).toBeNull(); // des travaux, pas une étude
    expect(pertinence(avis("Travaux de voirie, schéma directeur", "TRAVAUX"), profil(["FOURNITURES"]))).toBeNull();
  });

  it("une collectivité « Conseil » ne fait pas d'un achat une étude", () => {
    const c = { ...profil(["ETUDES"]), motsCles: ["ambulance"] };
    expect(pertinence(avis("Acquisition d'une ambulance au profit du Conseil Provincial", "FOURNITURES"), c)).toBeNull();
  });
});
