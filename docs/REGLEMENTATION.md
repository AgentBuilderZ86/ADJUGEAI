# Règles implémentées — décret n° 2-22-431

Source : décret n° 2-22-431 du 15 chaabane 1444 (8 mars 2023) relatif aux marchés publics, BO n° 7184 du
15 ramadan 1444 (6 avril 2023), édition française. Version consultée : PDF publié par le ministère de l'Équipement
(`equipement.gov.ma`, rubrique Ingénierie › Réglementation).

Code : `lib/marches/reglementation.ts`, `lib/marches/prix-reference.ts`, `lib/marches/simulation.ts`.
Tests : `lib/marches/*.test.ts`.

## Travaux, fournitures, services autres que les études (art. 43 et 44)

| Étape | Règle | Article |
|---|---|---|
| 1 | Écarter les offres **excessives** : > +20 % de l'estimation du maître d'ouvrage (E) | 44-B-1 |
| 2 | Écarter les offres **anormalement basses** : < −20 % de E (travaux), < −25 % de E (fournitures, services hors études) | 44-B-2 |
| 3 | **Prix de référence** P = (E + M) / 2, M = moyenne des offres retenues | 44-A |
| 4 | **Mieux-disante** : la plus proche de P **par défaut** ; à défaut d'offre inférieure à P, la plus proche **par excès** | 44-A, 43-II-1 |
| 5 | Égalité : tirage au sort, avec préférence aux coopératives et auto-entrepreneurs | 43-II-2 |
| 6 | Aucune offre retenue : appel d'offres infructueux | 45 |

## Études (art. 144)

| Étape | Règle |
|---|---|
| 1 | Écarter les offres sous le seuil d'admissibilité technique (fixé au RC) |
| 2 | Écarter les offres > +20 % ou < −25 % de E |
| 3 | Note financière : 100 pour la moins-disante, inversement proportionnelle pour les autres (sauf autre méthode prévue au RC) |
| 4 | Note globale = note technique × (1 − w) + note financière × w, avec w entre 10 et 40 points sur 100 |

## Points d'interprétation (à valider par un juriste marchés publics)

- « Supérieure / inférieure **de plus de** 20 % » : une offre exactement à la borne est **retenue**.
- Une offre exactement égale à P est traitée comme « par défaut ».
- Les montants comparés sont ceux après rectification des erreurs arithmétiques (art. 43-I-3).

## Hors périmètre à ce stade (signalé dans l'interface)

- Préférence nationale (art. 147 : ±15 % pour les concurrents non installés au Maroc).
- Gardiennage, nettoyage des bâtiments administratifs, entretien des espaces verts : critère du taux de majoration le
  plus faible (art. 43-II-1-a, 2e alinéa).
- Fournitures avec coût d'utilisation / maintenance (art. 21).
- Prix unitaires principaux excessifs ou anormalement bas (art. 44-C) : vérification post-classement.
- Intérêts moratoires (module Encaisser) : **à sourcer sur le texte en vigueur avant implémentation**.
