import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MODELE_CLAUDE } from "@/lib/claude";
import { BLOCS, KILL_SWITCHES } from "./grille";
import { profilEnTexte, type ProfilEntreprise } from "./profil";

const evaluationBloc = z.object({
  note: z.number().describe("Note de 0 (très défavorable) à 10 (très favorable)"),
  justification: z.string().describe("Une à trois phrases, en citant l'AO et le profil"),
});

const killSwitch = z.object({
  actif: z.boolean(),
  justification: z.string(),
});

export const schemaAnalyse = z.object({
  fiche: z.object({
    objet: z.string(),
    acheteur: z.string().nullable(),
    reference: z.string().nullable().describe("Numéro de l'AO"),
    typeMarche: z.enum(["TRAVAUX", "FOURNITURES", "SERVICES", "ETUDES"]).nullable(),
    estimationMad: z.number().nullable().describe("Estimation du maître d'ouvrage en MAD TTC, si indiquée"),
    cautionProvisoireMad: z.number().nullable(),
    dateLimite: z.string().nullable().describe("Date et heure limite de dépôt, format AAAA-MM-JJ HH:MM"),
    delaiExecution: z.string().nullable(),
    lieu: z.string().nullable(),
  }),
  resume: z.string().describe("Synthèse de l'AO en 3 à 5 phrases"),
  criteresEliminatoires: z.array(z.string()),
  referencesExigees: z.array(z.string()),
  qualificationsExigees: z.array(z.string()),
  risquesContractuels: z.array(z.string()),
  blocs: z.object({
    alignement: evaluationBloc,
    positionnement: evaluationBloc,
    references: evaluationBloc,
    competences: evaluationBloc,
    economie: evaluationBloc,
    risques: evaluationBloc,
  }),
  killSwitches: z.object({
    referencesEliminatoiresNonCouvertes: killSwitch,
    budgetInsuffisant: killSwitch,
    tropEditeur: killSwitch,
  }),
  pointsForts: z.array(z.string()),
  pointsVigilance: z.array(z.string()),
  questionsAcheteur: z.array(z.string()).describe("Questions à poser à l'acheteur avant la date limite"),
  informationsManquantes: z.array(z.string()).describe("Ce qui manque au profil ou au document pour juger"),
});

export type AnalyseAo = z.infer<typeof schemaAnalyse>;

/** Consigne stable (mise en cache) : ne pas y insérer de contenu variable. */
export const CONSIGNE = `Tu es un expert des marchés publics marocains (décret n° 2-22-431) qui aide une entreprise à décider si elle répond à un appel d'offres.

Tu reçois le dossier de l'AO (avis, règlement de consultation, CPS…) et le profil de l'entreprise. Tu :
1. extrais les informations clés de l'AO, sans rien inventer (null si absent) ;
2. évalues chacun des 6 blocs de la grille par une note de 0 à 10, justifiée par des éléments précis de l'AO et du profil ;
3. signales les kill switches strictement selon leur définition ;
4. listes points forts, points de vigilance, questions à poser à l'acheteur et informations manquantes.

Grille (le score et le verdict sont calculés par le logiciel à partir de tes notes, ne les calcule pas) :
${BLOCS.map((b) => `- ${b.cle} — ${b.nom} (${b.poids} points) : ${b.question}`).join("\n")}

Kill switches :
- referencesEliminatoiresNonCouvertes (${KILL_SWITCHES.referencesEliminatoiresNonCouvertes.effet}) : le RC ou le CPS exige des références, attestations ou qualifications éliminatoires que le profil ne couvre manifestement pas.
- budgetInsuffisant (${KILL_SWITCHES.budgetInsuffisant.effet}) : l'estimation est manifestement incompatible avec l'effort demandé.
- tropEditeur (${KILL_SWITCHES.tropEditeur.effet}) : le marché impose la fourniture de licences, la maintenance ou des SLA d'un produit logiciel que l'entreprise n'édite pas.

Règles :
- Si le profil est vide ou incomplet, note prudemment (autour de 5) les blocs qui en dépendent et indique ce qui manque ; n'active un kill switch que sur un élément explicite.
- Montants en dirhams (MAD), sans séparateur de milliers.
- Rédige en français, de façon concise et factuelle, comme un associé qui briefe son équipe.`;

export interface EntreeAnalyse {
  texte?: string;
  pdfBase64?: string;
  profil: ProfilEntreprise;
  precisions?: string;
}

export class AnalyseImpossible extends Error {}

export async function analyserAo(client: Anthropic, entree: EntreeAnalyse): Promise<AnalyseAo> {
  if (!entree.texte?.trim() && !entree.pdfBase64) throw new AnalyseImpossible("Aucun document à analyser.");

  const contenu: Anthropic.ContentBlockParam[] = [];
  if (entree.pdfBase64) {
    contenu.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: entree.pdfBase64 } });
  }
  contenu.push({
    type: "text",
    text: [
      `Profil de l'entreprise :\n${profilEnTexte(entree.profil)}`,
      entree.precisions?.trim() ? `Précisions de l'utilisateur :\n${entree.precisions.trim()}` : "",
      entree.texte?.trim() ? `Dossier de l'AO :\n<dossier>\n${entree.texte.trim()}\n</dossier>` : "Le dossier de l'AO est le document PDF joint.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const reponse = await client.messages.parse({
    model: MODELE_CLAUDE,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(schemaAnalyse) },
    system: [{ type: "text", text: CONSIGNE, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: contenu }],
  });

  if (reponse.stop_reason === "refusal") {
    throw new AnalyseImpossible("L'analyse a été refusée par le modèle pour ce document.");
  }
  if (reponse.stop_reason === "max_tokens" || !reponse.parsed_output) {
    throw new AnalyseImpossible("L'analyse est incomplète. Réessayez avec un document plus court (RC et CPS seulement).");
  }
  return reponse.parsed_output;
}
