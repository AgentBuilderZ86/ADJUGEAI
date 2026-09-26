import { Calculateur } from "@/components/chiffrer/calculateur";

export const metadata = { title: "Chiffrer" };

export default function Chiffrer() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold">Chiffrer</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Simulez le prix à déposer ou analysez une séance d&apos;ouverture des plis. L&apos;enregistrement des simulations
        dans vos dossiers arrive avec la vague 1.
      </p>
      <Calculateur />
    </div>
  );
}
