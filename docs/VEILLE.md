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
   `POST /api/veille/details` par lots de 8 fiches (estimation, caution), 4 lots au plus.
3. **Rattrapage** : elle lit elle-même jusqu'à 10 pages plus anciennes de 100 avis (le portail met ~15 s par page)
   et envoie chaque page analysée à `POST /api/veille/rattrapage`, qui l'enregistre. Un curseur reprend là où le
   passage précédent s'est arrêté ; le cycle est « complet » à la première page sans consultation ouverte, et ne
   recommence qu'après 24 h. Toutes les routes exigent `Authorization: Bearer $CRON_SECRET`.
4. Volume mesuré (26/09/2026) : un passage complet ≈ 50 requêtes en ~4 min 30 ; 50 avis récents, 32 fiches, 1 000 avis
   rattrapés. L'ensemble des consultations ouvertes (~40 à 50 jours de publications) est couvert en une journée environ.
5. Délai de 45 s par requête ; une panne ou un refus interrompt proprement le passage, repris au suivant.
6. Les avis sont partagés entre cabinets (données publiques) ; les profils de veille et les dossiers suivis sont cloisonnés.
7. Un administrateur peut lancer une collecte depuis `/veille` (même garde des 60 minutes), utile sur les deploy previews où les
   fonctions planifiées ne tournent pas.
8. **Alertes e-mail** : `netlify/functions/veille-alertes.mts` (chaque jour à 6 h 47 UTC, ≈ 7 h 47 au Maroc) appelle
   `POST /api/veille/alertes`. Pour chaque cabinet dont l'alerte est cochée : avis ouverts collectés depuis le dernier
   récapitulatif (36 h au plus), correspondant au profil et non suivis, envoyés à tous les utilisateurs du cabinet
   (15 détaillés, le reste renvoyé vers `/veille`). Sans `RESEND_API_KEY` et `ADJUGE_EMAIL_EXPEDITEUR`, rien n'est envoyé
   ni marqué comme signalé. Chaque envoi est journalisé (`veille.alerte`).

## Hors périmètre (à venir)

- Extraits de PV et résultats : pièces jointes PDF souvent scannées → OCR ; import assisté d'abord, automatisation après accord de la TGR.
- Autres plateformes d'acheteurs (OCP, ONEE, ANP…).
