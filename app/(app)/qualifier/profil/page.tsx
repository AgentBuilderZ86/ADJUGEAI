import Link from "next/link";
import { Card } from "@/components/ui/card";
import { FormulaireProfil } from "@/components/qualifier/formulaire-profil";
import { profilDepuis } from "@/lib/qualifier/profil";
import { requireTenant } from "@/lib/session";

export const metadata = { title: "Profil de l'entreprise" };

export default async function Profil() {
  const { db, tenantId, user } = await requireTenant();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  return (
    <div className="max-w-3xl">
      <Link href="/qualifier" className="text-sm text-slate-600 hover:text-marque-700">
        ← Qualifier
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Profil de l&apos;entreprise</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Utilisé pour évaluer l&apos;alignement, les références et les moyens face à chaque AO. Plus il est précis, plus le verdict est fiable.
      </p>
      <Card>
        <FormulaireProfil profil={profilDepuis(tenant?.profil)} modifiable={user.role !== "MEMBRE"} />
      </Card>
    </div>
  );
}
