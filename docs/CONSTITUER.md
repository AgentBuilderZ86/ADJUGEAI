# Constituer — pièces du dossier de réponse

Première brique du module 4 (vague 2), lancée à la demande du fondateur avant le seuil de la vague 1.

## Coffre-fort (`/constituer`)

Pièces administratives du cabinet, avec leur échéance et leur état (valide, à renouveler sous 30 jours, expirée,
sans échéance). Seules les durées fixées par le décret sont calculées automatiquement :

| Pièce | Durée | Source |
|---|---|---|
| Attestation de régularité fiscale | délivrée depuis moins d'un an | Décret 2-22-431, art. 28-I-A-2-a |
| Attestation CNSS | délivrée depuis moins d'un an | art. 28-I-A-2-b |

Pour les autres pièces (modèle 9, certificats de qualification, agréments…), l'échéance est saisie par l'utilisateur.
Le décret apprécie la validité des attestations fiscale et CNSS **à la date de leur production au maître d'ouvrage** ;
Adjugé l'évalue à la date limite de dépôt, ce qui est prudent mais pas exact : c'est indiqué à l'écran.

Les fichiers eux-mêmes ne sont pas encore stockés (prochaine étape : Netlify Blobs).

## Liste des pièces d'un dossier (`/constituer/[id]`)

Créée une fois par dossier, à la demande :

1. le socle du décret (art. 28 à 31) : pouvoirs, déclaration sur l'honneur, caution provisoire si l'avis ou le RC en
   exige une, pièces de l'attributaire pressenti, note des moyens, offre technique pour les études, acte d'engagement,
   bordereau des prix ;
2. les exigences propres au RC relevées par la qualification (qualifications, références, critères éliminatoires),
   marquées « à vérifier ».

Chaque ligne liée à un type du coffre-fort prend son statut du coffre-fort (prête ou expirée à la date de dépôt) ; les
autres sont suivies à la main (statut, responsable). L'avancement et les pièces éliminatoires non prêtes sont
affichés sur la page du dossier et dans `/constituer`.
