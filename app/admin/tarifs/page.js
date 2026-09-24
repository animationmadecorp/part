import Link from "next/link";
import TopBar from "@/components/TopBar";
import AdminFooter from "@/components/admin/AdminFooter";
import AccessBoundary from "../../nouveau/_components/AccessBoundary";
import { requireAdminPage } from "@/lib/server-auth";
import PricingManager from "./PricingManager";
import "../admin.css";
import "./pricing.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tarifs — Animation Made" };

export default async function AdminPricingPage() {
  const access = await requireAdminPage();
  const user = access.profile ? {
    id: access.profile.clerkUserId,
    email: access.profile.email || "Administrateur",
    name: access.profile.name || "Administrateur",
    role: access.profile.role,
  } : null;

  return <div className="am-admin-shell">
    <TopBar user={user} />
    <main className="am-admin-main">
      {access.ok ? <>
        <Link href="/admin" className="am-pricing-back">← Administration</Link>
        <header className="am-admin-heading am-pricing-heading">
          <p className="am-admin-eyebrow">Offres et paiements</p>
          <h1>Gérer les <em>tarifs.</em></h1>
          <p>Change un montant ici pour les nouvelles commandes. Les réservations et dossiers déjà créés conservent leur tarif enregistré.</p>
        </header>
        <PricingManager />
      </> : <AccessBoundary reason={access.reason} />}
    </main>
    <AdminFooter />
  </div>;
}
