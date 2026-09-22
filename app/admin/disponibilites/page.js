import Link from "next/link";
import TopBar from "@/components/TopBar";
import AdminFooter from "@/components/admin/AdminFooter";
import AccessBoundary from "../../nouveau/_components/AccessBoundary";
import { requireAdminPage } from "@/lib/server-auth";
import AvailabilityManager from "./AvailabilityManager";

export const metadata = {
  title: "Disponibilités — Animation Made",
};

export default async function AdminAvailabilityPage() {
  const access = await requireAdminPage();
  const user = access.profile
    ? {
        id: access.profile.clerkUserId,
        email: access.profile.email || "Administrateur",
        name: access.profile.name || "Administrateur",
        role: access.profile.role,
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      {access.ok ? (
        <main className="flex-1 mx-auto max-w-3xl w-full px-5 py-10">
          <Link href="/nouveau/demandes" className="text-muted text-sm hover:text-accent">
            ← Mes demandes
          </Link>
          <h1 className="font-display text-3xl mt-3 mb-1">Disponibilités de Made</h1>
          <p className="text-muted mb-8 max-w-2xl">
            Modifie les horaires habituels, ferme une journée ou applique une exception à une date précise.
          </p>
          <AvailabilityManager />
        </main>
      ) : <AccessBoundary reason={access.reason} />}
      <AdminFooter isSuper />
    </div>
  );
}
