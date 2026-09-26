import { LienBouton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MODULES } from "@/lib/modules";

export default function Accueil() {
  return (
    <>
      <section className="bg-gradient-to-b from-marque-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-marque-700">
            Marchés publics au Maroc · décret 2-22-431
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Le prix qui gagne. Et tout ce qu&apos;il faut autour.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Depuis 2023, l&apos;attributaire est l&apos;offre la plus proche <em>par défaut</em> du prix de référence,
            qui dépend des offres de vos concurrents. Adjugé simule leur comportement, calibré sur les résultats réels,
            et vous dit à quel prix déposer — puis vous accompagne de la veille jusqu&apos;à l&apos;encaissement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LienBouton href="/calculateur">Calculer un prix de référence</LienBouton>
            <LienBouton href="/inscription" variante="secondaire">
              Créer mon espace
            </LienBouton>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold">Tout le cycle d&apos;un marché, dans un seul outil</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Là où les outils de veille s&apos;arrêtent à la détection, Adjugé va jusqu&apos;au prix, au dossier, à
          l&apos;exécution et au paiement.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <Card key={m.cle}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">{String(i + 1).padStart(2, "0")}</span>
                <span
                  className={
                    m.vague === 1 && m.cle === "chiffrer"
                      ? "rounded bg-marque-100 px-2 py-0.5 text-xs font-medium text-marque-800"
                      : "rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  }
                >
                  {m.disponibilite}
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{m.nom}</h3>
              <p className="mt-1 text-sm text-slate-600">{m.promesse}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          <div>
            <h3 className="font-semibold">Fidèle au texte officiel</h3>
            <p className="mt-2 text-sm text-slate-600">
              Écartement des offres excessives et anormalement basses, prix de référence, classement par défaut puis par
              excès, notation technico-financière des études : chaque règle cite son article du décret.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Calibré sur les résultats réels</h3>
            <p className="mt-2 text-sm text-slate-600">
              Les montants lus en séance publique d&apos;ouverture des plis alimentent la simulation : par acheteur, par
              secteur, par concurrent.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Conçu par un praticien</h3>
            <p className="mt-2 text-sm text-slate-600">
              La méthode de qualification vient de 16 ans de réponse aux appels d&apos;offres. Vos données restent
              cloisonnées et ne sont jamais partagées avec un autre cabinet.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
