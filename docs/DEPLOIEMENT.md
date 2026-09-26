# Déploiement — Netlify

Projet Netlify : `adjugeai`. Chaque push sur une PR crée un *deploy preview* ; `main` part en production.

## Ce que Netlify fait automatiquement

| Élément | Mécanisme |
|---|---|
| Rendu Next.js (pages dynamiques, actions serveur, API) | Adaptateur `@netlify/plugin-nextjs`, **déclaré dans `netlify.toml`** — sans lui, `.next` est publié comme un site statique et toutes les routes répondent 404 |
| Base PostgreSQL | **Netlify Database**, provisionnée grâce à la dépendance `@netlify/database` ; l'URL est injectée dans `NETLIFY_DB_URL` (lue par `lib/prisma.ts`) |
| Schéma | Les fichiers `netlify/database/migrations/*/migration.sql` sont appliqués avant publication ; un échec bloque le déploiement |
| Isolation des previews | Chaque branche a sa propre branche de base, copiée depuis la production à sa création |

## Variables d'environnement (Netlify → Project configuration → Environment variables)

| Variable | Valeur | Contextes |
|---|---|---|
| `AUTH_SECRET` | Aléatoire (`openssl rand -base64 32`), **secret** | Production, Deploy previews, Branch deploys — une variable secrète ne peut pas utiliser le contexte « All » |
| `AUTH_TRUST_HOST` | `true` | Tous |
| `ANTHROPIC_API_KEY` | Clé API Anthropic, **secret** — nom exact, avec le H | Production, Deploy previews, Branch deploys |
| `ANTHROPIC_WORKSPACE_ID` | Identifiant `wrkspc_…` — **requis si la clé n'est pas rattachée à un workspace** (erreur « not scoped to a workspace ») ; inutile avec une clé créée dans un workspace | Tous |
| `CRON_SECRET` | Aléatoire, 32 caractères min., **secret** — protège les routes de collecte de la veille | Production, Deploy previews, Branch deploys |
| `ADJUGE_MODELE_CLAUDE` | Facultatif (défaut `claude-sonnet-5`) | Tous |

`DATABASE_URL` n'est **pas** à définir sur Netlify : Netlify Database fournit `NETLIFY_DB_URL`.

Une variable modifiée n'est prise en compte qu'au déploiement suivant.

## Vérifier un déploiement

```bash
B=https://deploy-preview-<n>--adjugeai.netlify.app
curl -s -o /dev/null -w '%{http_code}\n' $B/calculateur      # 200
curl -s -o /dev/null -w '%{http_code}\n' $B/qualifier        # 307 vers /connexion
curl -s $B/api/sante     # {"base":"ok","authentification":"configurée","qualification":"configurée",...}
```

Le résumé du déploiement Netlify doit indiquer les migrations appliquées et des fonctions déployées.

## Limites des fonctions (à garder en tête)

- Exécution synchrone : 60 s → analyse Qualifier bornée à 55 s (`lib/claude.ts`).
- Corps de requête : 6 Mo → PDF limités à 4 Mo (`app/(app)/qualifier/actions.ts`).
