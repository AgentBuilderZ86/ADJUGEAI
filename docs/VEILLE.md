# Veille — collecte des avis du Portail marocain des marchés publics (PMMP)

## Cadre juridique

| Élément | Constat (26/09/2026) |
|---|---|
| Base de publication | Décret n° 2-22-431, art. 134 : le portail, géré par la TGR, publie notamment les avis, les extraits de PV et les résultats |
| Réutilisation | Loi 31-13 (accès à l'information), art. 6 : réutilisation permise à des fins légitimes, sans altération, avec la source et la date |
| Conditions d'utilisation du portail | Aucune clause sur l'accès automatisé ou la réutilisation ; rubrique « données personnelles » vide |
| robots.txt | Absent |
| Pare-feu | Bloque les clients sans identification ; **accepte une identification honnête** (`AdjugeBot/1.0 (+https://adjugeai.netlify.app/robot)`) |
| Données personnelles | Les fiches détail comportent des contacts nominatifs d'agents : **jamais lus ni stockés** |

Démarche recommandée : informer la TGR (marchespublics@tgr.gov.ma) de la collecte et de ses règles, et demander un
accès officiel (export, liste blanche) — décision et envoi par le fondateur.

## Règles de conduite (implémentées dans `lib/veille/pmmp.ts`)

- Identification honnête, jamais d'usurpation de navigateur.
- 2,5 s minimum entre deux requêtes ; une collecte toutes les 2 heures ; refus de collecter moins de 60 minutes après la précédente.
- Arrêt immédiat sur 403, 429 ou 503, consigné dans `CollecteVeille`.
- Pas de téléchargement de DCE ; chaque avis affiché cite la source, la date de publication et renvoie vers le portail.

## Fonctionnement

1. `netlify/functions/veille-planifiee.mts` (toutes les 2 h, production uniquement) déclenche
   `veille-collecte-background.mts` (15 min max).
2. Celle-ci appelle `POST /api/veille/collecte` (50 avis les plus récents : 3 à 4 requêtes) puis
   `POST /api/veille/details` par lots de 8 fiches (estimation, caution). Les deux routes exigent `Authorization: Bearer $CRON_SECRET`.
3. Les avis sont partagés entre cabinets (données publiques) ; les profils de veille et les dossiers suivis sont cloisonnés.
4. Un administrateur peut lancer une collecte depuis `/veille` (même garde des 60 minutes), utile sur les deploy previews où les
   fonctions planifiées ne tournent pas.

## Hors périmètre (à venir)

- Extraits de PV et résultats : pièces jointes PDF souvent scannées → OCR ; import assisté d'abord, automatisation après accord de la TGR.
- Alertes e-mail (fournisseur d'envoi à configurer).
- Autres plateformes d'acheteurs (OCP, ONEE, ANP…).
