# Adjugé

Plateforme SaaS pour gagner et exécuter les marchés publics au Maroc : veille, qualification, **chiffrage
réglementaire (décret 2-22-431)**, constitution du dossier, résultats, exécution, encaissement, comptes.

- Vision, cibles, modèle économique et feuille de route : [`docs/VISION.md`](docs/VISION.md)
- Règles du décret implémentées, avec articles et points d'interprétation : [`docs/REGLEMENTATION.md`](docs/REGLEMENTATION.md)

## État — vague 0

| Livré | Détail |
|---|---|
| Socle | Next.js 15 (App Router), TypeScript, Tailwind 4, Prisma 6 / PostgreSQL, NextAuth v5 (e-mail + mot de passe) |
| Modèle de données | Les 8 modules (`prisma/schema.prisma`) : données publiques partagées + données clientes cloisonnées |
| Cloisonnement | `lib/tenant.ts` : filtre `tenantId` imposé sur toute requête ; test d'isolation contre une vraie base |
| Moteur de chiffrage | Évaluation des offres (art. 43, 44, 144), simulation Monte Carlo, calibration sur historique |
| Calculateur public | `/calculateur` — gratuit, sans inscription, calcul dans le navigateur |
| Espace client | Inscription du cabinet (consentement loi 09-08, journal d'audit), connexion, tableau de bord, `/chiffrer` |

## Démarrer

```bash
npm install
cp .env.example .env          # renseigner DATABASE_URL et AUTH_SECRET
npm run db:push               # crée le schéma
npm run dev                   # http://localhost:3000
```

## Vérifier

```bash
npm run lint && npm run typecheck
npm test                      # moteur de chiffrage + isolation (si DATABASE_URL est défini)
npm run build
```

La CI (`.github/workflows/ci.yml`) exécute ces étapes avec un PostgreSQL 16.

## Règles de développement

- **Clean-room** : aucun code, nom, donnée ou export issu de dépôts ou données Sia Partners.
- **Données clientes** : uniquement via `requireTenant()` (`lib/session.ts`), jamais via le client Prisma brut ;
  le `tenantId` vient de la session, jamais du navigateur.
- **Aucune écriture silencieuse** : toute modification d'une donnée cliente est confirmée dans l'interface et tracée
  dans `AuditLog`.
- **Réglementation** : aucune règle sans article sourcé dans `docs/REGLEMENTATION.md`.
- **Français d'abord** : interface, messages d'erreur, noms métier.
