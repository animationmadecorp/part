import Link from "next/link";
import AccessBoundary from "../nouveau/_components/AccessBoundary";
import AdminFooter from "@/components/admin/AdminFooter";
import TopBar from "@/components/TopBar";
import { getSanityConfigurationStatus, getSanityStudioStatus } from "@/lib/sanity/config";
import { SANITY_EDITORIAL_REVALIDATE_SECONDS } from "@/lib/sanity/queries";
import { requireAdminPage } from "@/lib/server-auth";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administration — Animation Made",
};

function navigationUser(profile) {
  if (!profile) return null;
  return {
    id: profile.clerkUserId,
    email: profile.email || "Administrateur",
    name: profile.name || "Administrateur",
    role: profile.role,
  };
}

function studioConfigurationMessage(studio) {
  if (studio.reason === "local_url_in_production") {
    return "Une URL localhost est refusée en production. Renseigne l’URL du Studio hébergé.";
  }
  if (studio.reason === "insecure_url_in_production") {
    return "Une URL HTTPS du Studio hébergé est requise en production.";
  }
  if (studio.reason === "invalid_url") {
    return "L’URL configurée n’est pas valide. Utilise une URL HTTPS complète.";
  }
  return "La gestion des contenus doit encore être reliée.";
}

export default async function AdminHomePage() {
  const access = await requireAdminPage();
  const user = navigationUser(access.profile);

  if (!access.ok) {
    return (
      <div className="am-admin-shell">
        <TopBar user={user} />
        <main className="am-admin-main">
          <AccessBoundary reason={access.reason} />
        </main>
        <AdminFooter />
      </div>
    );
  }

  const studio = getSanityStudioStatus();
  const sanity = getSanityConfigurationStatus();

  return (
    <div className="am-admin-shell">
      <TopBar user={user} />
      <main className="am-admin-main">
        <header className="am-admin-heading">
          <p className="am-admin-eyebrow">Espace propriétaire</p>
          <h1>Administration <em>Animation Made.</em></h1>
          <p>Retrouve ici les demandes, les cours, les disponibilités et les contenus de ton activité.</p>
        </header>

        <section className="am-admin-grid" aria-label="Accès administration">
          <AdminLinkCard
            href="/nouveau/demandes"
            eyebrow="Dossiers clients"
            title="Demandes"
            body="Lire les questionnaires et envoyer tes retours."
          />
          <AdminLinkCard
            href="/admin/reservations"
            eyebrow="Cours d’anglais"
            title="Cours réservés"
            body="Consulter tes cours et gérer les liens Google Meet."
          />
          <AdminLinkCard
            href="/admin/disponibilites"
            eyebrow="Agenda"
            title="Disponibilités"
            body="Modifier tes horaires habituels et les exceptions de calendrier."
          />
          <AdminContentCard studio={studio} />
        </section>

        <details className="am-admin-technical">
          <summary>État technique</summary>
          <div className="am-admin-technical-body">
            <p>{sanity.revalidationReady ? "Le secret du webhook est renseigné ; son activation externe reste à vérifier." : "Le webhook de publication doit encore être configuré."} Repli automatique : {SANITY_EDITORIAL_REVALIDATE_SECONDS} secondes.</p>
            <Link className="am-admin-action am-admin-action-muted" href="/api/sanity/status" target="_blank">
              Voir l’état détaillé <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </details>
      </main>
      <AdminFooter />
    </div>
  );
}

function AdminLinkCard({ href, eyebrow, title, body }) {
  return (
    <Link className="am-admin-link-card" href={href}>
      <span className="am-admin-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <span className="am-admin-card-action">Ouvrir <span aria-hidden="true">→</span></span>
    </Link>
  );
}

function AdminContentCard({ studio }) {
  const content = (
    <>
      <span className="am-admin-eyebrow">Édition</span>
      <h2>Contenus et add-ons</h2>
      <p>{studio.configured ? "Modifier les contenus et les add-ons dans Sanity." : studioConfigurationMessage(studio)}</p>
      <span className="am-admin-card-action">{studio.configured ? "Gérer les contenus" : "À relier"} <span aria-hidden="true">{studio.configured ? "↗" : "·"}</span></span>
    </>
  );

  if (!studio.configured) return <article className="am-admin-link-card am-admin-link-card-disabled" aria-label="Contenus et add-ons à relier">{content}</article>;
  return <a className="am-admin-link-card" href={studio.url} target="_blank" rel="noreferrer noopener">{content}</a>;
}
