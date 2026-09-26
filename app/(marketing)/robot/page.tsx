import type { Metadata } from "next";

export const metadata: Metadata = { title: "AdjugeBot — collecteur de la veille" };

export default function Robot() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-encre">AdjugeBot</h1>
      <p>
        AdjugeBot est le collecteur de la veille d&apos;Adjugé. Il lit les avis d&apos;appels d&apos;offres publiés sur le Portail marocain
        des marchés publics, publiés en application du décret n° 2-22-431 (art. 134). Il s&apos;en sert pour signaler à ses utilisateurs
        les consultations qui correspondent à leur activité.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-encre">Règles de conduite</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          Identification transparente : agent utilisateur <code className="rounded bg-slate-100 px-1">AdjugeBot/1.0</code> avec un lien vers
          cette page. Jamais d&apos;usurpation d&apos;un navigateur.
        </li>
        <li>Faible débit : une collecte toutes les deux heures au plus, quelques requêtes espacées de plusieurs secondes.</li>
        <li>Arrêt immédiat en cas de refus ou de surcharge du portail (codes 403, 429 ou 503).</li>
        <li>
          Ni donnée personnelle ni dossier de consultation conservés : seuls l&apos;objet, l&apos;acheteur, le lieu, les dates, l&apos;estimation
          et la caution sont repris, avec la source et la date de publication (loi 31-13, art. 6).
        </li>
        <li>Chaque avis renvoie vers sa page d&apos;origine sur le portail.</li>
      </ul>
      <h2 className="pt-4 text-xl font-semibold text-encre">Contact</h2>
      <p>
        Pour toute question ou demande d&apos;arrêt :{" "}
        {process.env.NEXT_PUBLIC_CONTACT_EMAIL ? (
          <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`} className="text-marque-700 underline">
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
          </a>
        ) : (
          "adresse de contact en cours de mise en place"
        )}
        . Toute demande de l&apos;administration du portail est appliquée sans délai.
      </p>
    </div>
  );
}
