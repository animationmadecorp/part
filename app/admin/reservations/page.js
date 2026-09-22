import Link from "next/link";
import TopBar from "@/components/TopBar";
import AdminFooter from "@/components/admin/AdminFooter";
import AccessBoundary from "../../nouveau/_components/AccessBoundary";
import { requireAdminPage } from "@/lib/server-auth";
import BookingAdminManager from "./BookingAdminManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Réservations — Animation Made",
};

export default async function AdminBookingsPage() {
  const access = await requireAdminPage();
  const user = access.profile
    ? {
        id: access.profile.clerkUserId,
        email: access.profile.email || "Administrateur",
        name: access.profile.name || "Administrateur",
        role: access.profile.role,
      }
    : null;
  return <div className="min-h-screen flex flex-col">
    <TopBar user={user} />
    {access.ok ? <main className="flex-1 mx-auto max-w-5xl w-full px-5 py-10"><Link href="/nouveau/demandes" className="text-muted text-sm hover:text-accent">← Mes demandes</Link><h1 className="font-display text-3xl mt-3 mb-1">Réservations d’anglais</h1><p className="text-muted mb-8 max-w-2xl">Suivi des cours confirmés, reports accordés et liens Google Meet. Les détails restent visibles uniquement par l’administratrice.</p><BookingAdminManager /></main> : <AccessBoundary reason={access.reason} />}
    <AdminFooter />
  </div>;
}
