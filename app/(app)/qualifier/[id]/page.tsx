import Link from "next/link";
import { notFound } from "next/navigation";
import { LienBouton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BoutonImprimer } from "@/components/bouton-imprimer";
import { FormulaireCorrection } from "@/components/qualifier/formulaire-correction";
import { BadgeVerdict } from "@/components/qualifier/verdict";
import type { AnalyseAo } from "@/lib/qualifier/analyse";
import { BLOCS, KILL_SWITCHES, SEUILS_VERDICT, type CleBloc, type CleKillSwitch } from "@/lib/qualifier/grille";
import { requireTenant } from "@/lib/session";
import { mad } from "@/lib/utils";

export const metadata = { title: "Qualification" };

type Synthese = Pick<
  AnalyseAo,
  "fiche" | "resume" | "criteresEliminatoires" | "referencesExigees" | "qualificationsExigees" | "risquesContractuels" | "questionsAcheteur" | "informationsManquantes"
> & { scoreBrut: number };
type Motifs = Pick<AnalyseAo, "blocs" | "killSwitches" | "pointsForts" | "pointsVigilance">;

const TYPES_CHIFFRAGE = { TRAVAUX: "travaux", FOURNITURES: "fournitures", SERVICES: "services" } as const;

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireTenant();
  const dossier = await db.dossier.findUnique({
    where: { id },
    include: { qualifications: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const q = dossier?.qualifications[0];
  if (!dossier || !q) notFound();

  const s = q.syntheseIa as unknown as Synthese;
  const m = q.motifs as unknown as Motifs;
  const parBloc = q.scoreParBloc as Record<CleBloc, number>;
  const kills = (q.killSwitch?.split(",").filter(Boolean) ?? []) as CleKillSwitch[];
  const typeChiffrage = dossier.typeMarche && dossier.typeMarche !== "ETUDES" ? TYPES_CHIFFRAGE[dossier.typeMarche] : null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/qualifier" className="text-sm text-slate-600 hover:text-marque-700">
          ← Tous les AO
        </Link>
        <div className="flex gap-2">
          {typeChiffrage && dossier.estimation && (
            <LienBouton href={`/chiffrer?type=${typeChiffrage}&estimation=${Number(dossier.estimation)}`} variante="secondaire">
              Chiffrer cet AO
            </LienBouton>
          )}
          <BoutonImprimer />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold">{dossier.titre}</h1>
          <p className="mt-1 text-slate-600">
            {[s.fiche.acheteur, s.fiche.reference && `AO n° ${s.fiche.reference}`, s.fiche.lieu].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <BadgeVerdict verdict={q.verdict} grand />
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {q.scoreTotal}
            <span className="text-base font-normal text-slate-500"> /100</span>
          </p>
          {q.corrige && <p className="text-xs text-slate-500">Verdict corrigé manuellement</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Estimation", s.fiche.estimationMad ? mad(s.fiche.estimationMad) : "—"],
          ["Caution provisoire", s.fiche.cautionProvisoireMad ? mad(s.fiche.cautionProvisoireMad) : "—"],
          ["Date limite", s.fiche.dateLimite ?? "—"],
          ["Délai d'exécution", s.fiche.delaiExecution ?? "—"],
        ].map(([l, v]) => (
          <Card key={l}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{l}</p>
            <p className="mt-1 font-semibold">{v}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold">Synthèse</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{s.resume}</p>
      </Card>

      {kills.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <h2 className="font-semibold text-red-900">Critère bloquant</h2>
          <ul className="mt-2 space-y-2 text-sm text-red-900">
            {kills.map((k) => (
              <li key={k}>
                <span className="font-medium">
                  {KILL_SWITCHES[k].libelle} — {KILL_SWITCHES[k].effet}.
                </span>{" "}
                {m.killSwitches[k]?.justification}
              </li>
            ))}
          </ul>
          {kills.some((k) => k !== "referencesEliminatoiresNonCouvertes") && (
            <p className="mt-2 text-xs text-red-800">Score avant plafonnement : {s.scoreBrut}/100.</p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Score par bloc</h2>
        <p className="text-xs text-slate-500">
          Seuils : GO ≥ {SEUILS_VERDICT.go} · GO conditionnel ≥ {SEUILS_VERDICT.goConditionnel} · NO GO par défaut ≥ {SEUILS_VERDICT.noGoDefaut}
        </p>
        <ul className="mt-4 space-y-4">
          {BLOCS.map((b) => {
            const pts = parBloc[b.cle] ?? 0;
            return (
              <li key={b.cle}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium">{b.nom}</span>
                  <span className="tabular-nums text-slate-600">
                    {pts} / {b.poids}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={b.poids} aria-valuenow={pts} aria-label={b.nom}>
                  <div className="h-2 rounded-full bg-marque-700" style={{ width: `${(pts / b.poids) * 100}%` }} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{m.blocs[b.cle]?.justification}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Liste titre="Critères éliminatoires" items={s.criteresEliminatoires} />
        <Liste titre="Références exigées" items={s.referencesExigees} />
        <Liste titre="Qualifications et agréments" items={s.qualificationsExigees} />
        <Liste titre="Risques contractuels" items={s.risquesContractuels} />
        <Liste titre="Points forts" items={m.pointsForts} />
        <Liste titre="Points de vigilance" items={m.pointsVigilance} />
        <Liste titre="Questions à poser à l'acheteur" items={s.questionsAcheteur} />
        <Liste titre="Informations manquantes" items={s.informationsManquantes} />
      </div>

      <Card className="print:hidden">
        <h2 className="font-semibold">Votre décision</h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          Vous n&apos;êtes pas d&apos;accord avec le verdict ? Corrigez-le : la correction est tracée et sert à ajuster la grille.
        </p>
        <FormulaireCorrection qualificationId={q.id} dossierId={dossier.id} verdict={q.verdict} />
      </Card>

      <p className="text-xs text-slate-500">
        Qualifié le {q.createdAt.toLocaleString("fr-FR")}. Analyse assistée par IA : à vérifier sur le dossier original avant toute décision engageante.
      </p>
    </div>
  );
}

function Liste({ titre, items }: { titre: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <Card>
      <h3 className="text-sm font-semibold">{titre}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </Card>
  );
}
