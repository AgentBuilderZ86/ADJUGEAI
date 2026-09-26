"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { CourbeGain } from "@/components/chiffrer/courbe-gain";
import { evaluerOffres, evaluerOffresEtudes } from "@/lib/marches/prix-reference";
import { REFERENCES, SEUILS, TYPES_MARCHE, type TypeMarche } from "@/lib/marches/reglementation";
import { lireHistorique, lireMontant, lireOffres } from "@/lib/marches/saisie";
import {
  calibrer,
  MODELE_PAR_DEFAUT,
  modeleDepuisCalibration,
  simulerPrix,
  type ModeleConcurrence,
  type ResultatSimulation,
} from "@/lib/marches/simulation";
import { cn, mad, pct } from "@/lib/utils";

type Onglet = "simuler" | "analyser";

export function Calculateur() {
  const [onglet, setOnglet] = useState<Onglet>("simuler");
  return (
    <div>
      <div role="tablist" className="mb-6 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {(
          [
            ["simuler", "Quel prix déposer ?"],
            ["analyser", "Analyser un résultat"],
          ] as const
        ).map(([cle, libelle]) => (
          <button
            key={cle}
            role="tab"
            aria-selected={onglet === cle}
            onClick={() => setOnglet(cle)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium",
              onglet === cle ? "bg-white shadow-sm" : "text-slate-600 hover:text-encre",
            )}
          >
            {libelle}
          </button>
        ))}
      </div>
      {onglet === "simuler" ? <Simuler /> : <Analyser />}
    </div>
  );
}

// ───────────────────────────── Simuler ─────────────────────────────

function Simuler() {
  const [type, setType] = useState<Exclude<TypeMarche, "etudes">>("travaux");
  const [estimation, setEstimation] = useState("2 500 000");
  const [cout, setCout] = useState("");
  const [nMin, setNMin] = useState(MODELE_PAR_DEFAUT.nombreConcurrents.min);
  const [nMax, setNMax] = useState(MODELE_PAR_DEFAUT.nombreConcurrents.max);
  const [moyenne, setMoyenne] = useState(95);
  const [ecart, setEcart] = useState(8);
  const [historique, setHistorique] = useState("");
  const [resultat, setResultat] = useState<ResultatSimulation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const calibration = useMemo(() => {
    const { lignes, erreurs } = lireHistorique(historique);
    return { c: calibrer(lignes), erreurs };
  }, [historique]);

  function lancer() {
    setErreur(null);
    const E = lireMontant(estimation);
    if (!E) return setErreur("Indiquez l'estimation du maître d'ouvrage (publiée dans l'avis ou le RC).");
    const C = cout.trim() ? lireMontant(cout) : undefined;
    if (cout.trim() && !C) return setErreur("Coût de revient illisible.");
    const modele: ModeleConcurrence = calibration.c
      ? modeleDepuisCalibration(calibration.c)
      : {
          nombreConcurrents: { min: Math.min(nMin, nMax), max: Math.max(nMin, nMax) },
          distribution: { type: "normale", moyenne: moyenne / 100, ecartType: ecart / 100 },
        };
    try {
      setResultat(simulerPrix({ type, estimation: E, modele, cout: C ?? undefined, iterations: 4000 }));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  const reco = resultat?.recommandation;
  const seuils = SEUILS[type];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="type">Type de marché</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TYPES_MARCHE.filter((t) => t.valeur !== "etudes").map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">
            Offres retenues entre −{seuils.bas * 100} % et +{seuils.haut * 100} % de l&apos;estimation (
            {REFERENCES.articles.seuils}).
          </p>
        </div>
        <div>
          <Label htmlFor="estimation">Estimation du maître d&apos;ouvrage (MAD)</Label>
          <Input id="estimation" inputMode="decimal" value={estimation} onChange={(e) => setEstimation(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cout">Votre coût de revient (MAD, facultatif)</Label>
          <Input id="cout" inputMode="decimal" value={cout} placeholder="ex. 2 050 000" onChange={(e) => setCout(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Renseigné : on maximise la marge espérée. Sinon : la probabilité de gain.</p>
        </div>

        <fieldset className="space-y-3 rounded-md border border-slate-200 p-3" disabled={!!calibration.c}>
          <legend className="px-1 text-sm font-medium">Hypothèses sur la concurrence</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nmin">Concurrents min.</Label>
              <Input id="nmin" type="number" min={0} max={40} value={nMin} onChange={(e) => setNMin(+e.target.value)} />
            </div>
            <div>
              <Label htmlFor="nmax">Concurrents max.</Label>
              <Input id="nmax" type="number" min={0} max={40} value={nMax} onChange={(e) => setNMax(+e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="moy">Offre moyenne des concurrents : {moyenne} % de l&apos;estimation</Label>
            <input id="moy" type="range" min={75} max={115} value={moyenne} onChange={(e) => setMoyenne(+e.target.value)} className="w-full accent-marque-700" />
          </div>
          <div>
            <Label htmlFor="ecart">Dispersion (écart-type) : {ecart} points</Label>
            <input id="ecart" type="range" min={1} max={20} value={ecart} onChange={(e) => setEcart(+e.target.value)} className="w-full accent-marque-700" />
          </div>
          <p className="text-xs text-slate-500">
            Valeurs par défaut = hypothèses, pas des données observées. Collez votre historique ci-dessous pour les remplacer.
          </p>
        </fieldset>

        <div>
          <Label htmlFor="historique">Historique d&apos;AO comparables (facultatif)</Label>
          <Textarea
            id="historique"
            rows={4}
            value={historique}
            placeholder={"Une ligne par AO : estimation ; offre 1 ; offre 2 ; …\n1 800 000 ; 1 650 000 ; 1 720 000 ; 1 910 000"}
            onChange={(e) => setHistorique(e.target.value)}
          />
          {calibration.c && (
            <p className="mt-1 text-xs text-marque-800">
              Calibré sur {calibration.c.echantillons} AO ({calibration.c.ratios.length} offres) : moyenne{" "}
              {pct(calibration.c.moyenne)} de l&apos;estimation, {calibration.c.concurrentsParAo.min} à{" "}
              {calibration.c.concurrentsParAo.max} soumissionnaires.
            </p>
          )}
          {calibration.erreurs.map((e) => (
            <p key={e} className="mt-1 text-xs text-red-700">
              {e}
            </p>
          ))}
        </div>

        <Button onClick={lancer} className="w-full">
          Lancer la simulation
        </Button>
        {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      </Card>

      <div className="space-y-4">
        {!resultat && (
          <Card className="text-sm text-slate-600">
            <p className="font-medium text-encre">Comment ça marche</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Les offres excessives et anormalement basses sont écartées ({REFERENCES.articles.seuils}).</li>
              <li>Prix de référence P = (estimation + moyenne des offres retenues) / 2 ({REFERENCES.articles.prixReference}).</li>
              <li>L&apos;attributaire est l&apos;offre la plus proche de P par défaut ; à défaut, par excès.</li>
              <li>Adjugé simule des milliers de scénarios de concurrence et mesure, pour chaque prix, vos chances de gagner.</li>
            </ol>
          </Card>
        )}
        {resultat && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-xs uppercase tracking-wide text-slate-500">Prix recommandé</p>
                <p className="mt-1 text-2xl font-bold">{reco ? mad(reco.prix) : "—"}</p>
                {reco && <p className="text-sm text-slate-600">{pct(reco.ratio)} de l&apos;estimation</p>}
              </Card>
              <Card>
                <p className="text-xs uppercase tracking-wide text-slate-500">Probabilité de gain</p>
                <p className="mt-1 text-2xl font-bold">{reco ? pct(reco.probabiliteGain, 0) : "—"}</p>
                {reco?.margeEsperee != null && <p className="text-sm text-slate-600">Marge espérée {mad(reco.margeEsperee)}</p>}
              </Card>
              <Card>
                <p className="text-xs uppercase tracking-wide text-slate-500">Prix de référence probable</p>
                <p className="mt-1 text-2xl font-bold">{resultat.prixReferenceSimule ? mad(resultat.prixReferenceSimule.p50) : "—"}</p>
                {resultat.prixReferenceSimule && (
                  <p className="text-sm text-slate-600">
                    80 % des cas entre {mad(resultat.prixReferenceSimule.p10)} et {mad(resultat.prixReferenceSimule.p90)}
                  </p>
                )}
              </Card>
            </div>
            <Card>
              <p className="mb-2 text-sm font-medium">Probabilité de gain selon le prix déposé</p>
              <CourbeGain points={resultat.points} recommande={reco ?? null} />
            </Card>
            <p className="text-xs text-slate-500">
              {resultat.iterations.toLocaleString("fr-FR")} scénarios simulés. Aide à la décision : le résultat dépend des
              hypothèses de concurrence ; il ne garantit pas l&apos;attribution. Les critères administratifs et techniques
              restent éliminatoires en amont.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Analyser ─────────────────────────────

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  retenue: { libelle: "Retenue", classe: "text-slate-700" },
  excessive: { libelle: "Excessive — écartée", classe: "text-red-700" },
  anormalement_basse: { libelle: "Anormalement basse — écartée", classe: "text-red-700" },
  technique_insuffisante: { libelle: "Note technique insuffisante", classe: "text-red-700" },
};

function Analyser() {
  const [type, setType] = useState<TypeMarche>("travaux");
  const [estimation, setEstimation] = useState("1 000 000");
  const [texte, setTexte] = useState("Entreprise A ; 830 000\nEntreprise B ; 905 000\nEntreprise C ; 960 000\nEntreprise D ; 1 040 000\nEntreprise E ; 760 000");
  const [ponderation, setPonderation] = useState(30);
  const [seuilTech, setSeuilTech] = useState(70);

  const analyse = useMemo(() => {
    const E = lireMontant(estimation);
    const { offres, erreurs } = lireOffres(texte);
    if (!E) return { erreurs: ["Estimation illisible."], lignes: [] as Ligne[] };
    try {
      if (type === "etudes") {
        const manquantes = offres.filter((o) => o.noteTechnique === undefined);
        if (manquantes.length) return { erreurs: [...erreurs, "Études : ajoutez la note technique (« Nom ; montant ; note »)."], lignes: [] };
        const r = evaluerOffresEtudes({
          estimation: E,
          ponderationFinanciere: ponderation,
          seuilTechnique: seuilTech,
          offres: offres.map((o, i) => ({ id: String(i), montant: o.montant, noteTechnique: o.noteTechnique! })),
        });
        return {
          erreurs,
          infructueux: r.infructueux,
          lignes: r.offres.map((o) => ({
            nom: offres[+o.id].nom,
            montant: o.montant,
            statut: o.statut,
            detail: o.noteGlobale != null ? `Note globale ${o.noteGlobale.toFixed(2)} (tech. ${o.noteTechnique}, fin. ${o.noteFinanciere!.toFixed(2)})` : "",
            rang: o.rang,
            gagnant: r.mieuxDisantes.includes(o.id),
          })),
        };
      }
      const r = evaluerOffres(type, E, offres.map((o, i) => ({ id: String(i), montant: o.montant })));
      return {
        erreurs,
        infructueux: r.infructueux,
        prixReference: r.prixReference,
        moyenne: r.moyenneRetenues,
        bornes: [r.seuilBas, r.seuilHaut] as const,
        exAequo: r.mieuxDisantes.length > 1,
        lignes: r.offres.map((o) => ({
          nom: offres[+o.id].nom,
          montant: o.montant,
          statut: o.statut,
          detail: `${o.ecartEstimation >= 0 ? "+" : ""}${pct(o.ecartEstimation)} / estimation${
            o.ecartReference !== null ? ` · ${o.ecartReference >= 0 ? "+" : ""}${pct(o.ecartReference)} / P` : ""
          }`,
          rang: o.rang,
          gagnant: r.mieuxDisantes.includes(o.id),
        })),
      };
    } catch (e) {
      return { erreurs: [(e as Error).message], lignes: [] };
    }
  }, [type, estimation, texte, ponderation, seuilTech]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="type-a">Type de marché</Label>
          <Select id="type-a" value={type} onChange={(e) => setType(e.target.value as TypeMarche)}>
            {TYPES_MARCHE.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="estimation-a">Estimation du maître d&apos;ouvrage (MAD)</Label>
          <Input id="estimation-a" inputMode="decimal" value={estimation} onChange={(e) => setEstimation(e.target.value)} />
        </div>
        {type === "etudes" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pond">Poids financier (10–40)</Label>
              <Input id="pond" type="number" min={10} max={40} value={ponderation} onChange={(e) => setPonderation(+e.target.value)} />
            </div>
            <div>
              <Label htmlFor="seuil">Seuil technique /100</Label>
              <Input id="seuil" type="number" min={0} max={100} value={seuilTech} onChange={(e) => setSeuilTech(+e.target.value)} />
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="offres">Offres lues en séance publique</Label>
          <Textarea id="offres" rows={8} value={texte} onChange={(e) => setTexte(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">
            Une offre par ligne : « Nom ; montant »{type === "etudes" ? " ; note technique" : ""}. Copier-coller depuis Excel accepté.
          </p>
        </div>
      </Card>

      <div className="space-y-4">
        {analyse.erreurs.map((e) => (
          <p key={e} className="text-sm text-red-700">
            {e}
          </p>
        ))}
        {"prixReference" in analyse && analyse.prixReference != null && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Prix de référence P</p>
              <p className="mt-1 text-2xl font-bold">{mad(analyse.prixReference)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Moyenne des offres retenues</p>
              <p className="mt-1 text-2xl font-bold">{mad(analyse.moyenne!)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Bornes de recevabilité</p>
              <p className="mt-1 text-lg font-bold">
                {mad(analyse.bornes![0])} – {mad(analyse.bornes![1])}
              </p>
            </Card>
          </div>
        )}
        {analyse.infructueux && (
          <Card className="text-sm">Aucune offre retenue : l&apos;appel d&apos;offres serait déclaré infructueux (art. 45).</Card>
        )}
        {analyse.lignes.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Rang</th>
                  <th className="px-4 py-2">Soumissionnaire</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2">Statut</th>
                  <th className="px-4 py-2">Détail</th>
                </tr>
              </thead>
              <tbody>
                {[...analyse.lignes]
                  .sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999))
                  .map((l, i) => (
                    <tr key={i} className={cn("border-b border-slate-100 last:border-0", l.gagnant && "bg-marque-50")}>
                      <td className="px-4 py-2 font-medium">{l.rang ?? "—"}</td>
                      <td className="px-4 py-2">
                        {l.nom}
                        {l.gagnant && <span className="ml-2 rounded bg-marque-700 px-1.5 py-0.5 text-xs text-white">Mieux-disante</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{mad(l.montant)}</td>
                      <td className={cn("px-4 py-2", STATUTS[l.statut].classe)}>{STATUTS[l.statut].libelle}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{l.detail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        )}
        {"exAequo" in analyse && analyse.exAequo && (
          <p className="text-sm text-slate-600">Égalité : départage par tirage au sort (art. 43-II-2), avec préférence aux coopératives et auto-entrepreneurs.</p>
        )}
        <p className="text-xs text-slate-500">
          Calcul conforme aux {REFERENCES.articles.evaluation}, {REFERENCES.articles.prixReference}, {REFERENCES.articles.seuils} et{" "}
          {REFERENCES.articles.etudes} du {REFERENCES.decret}. Ne tient pas compte de la préférence nationale (
          {REFERENCES.articles.preferenceNationale}), des régimes particuliers (gardiennage, nettoyage, espaces verts) ni
          des méthodes de notation différentes prévues au RC.
        </p>
      </div>
    </div>
  );
}

type Ligne = { nom: string; montant: number; statut: string; detail: string; rang: number | null; gagnant: boolean };
