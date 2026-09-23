"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useConvexConnectionState, useQuery, useQuery_experimental } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, BookOpen, LayoutDashboard, MessageSquare, Search, ShieldCheck, UserRound } from "lucide-react";
import { Brand } from "../_components/Shared";
import ConvexErrorBoundary from "../_components/ConvexErrorBoundary";
import Account from "./Account";
import Planner from "./Planner";
import EnglishLibrary from "./EnglishLibrary";
import ProjectFollowUp from "./ProjectFollowUp";
import { resolveRequestStatus, resolveResourceAccess } from "./accessLogic.mjs";
import { resolveFollowUps } from "./followUpAccess.mjs";

const tabs = [["Tableau de bord", LayoutDashboard], ["Ma bibliothèque", BookOpen], ["Mon suivi", MessageSquare], ["Mon compte", UserRound]];

export default function Library(props) {
  return <ConvexErrorBoundary title="Ta bibliothèque est momentanément indisponible."><LibraryIdentityContent {...props}/></ConvexErrorBoundary>;
}

function LibraryIdentityContent(props) {
  const { isLoaded, userId } = useAuth();
  const { initialFollowUp = null, initialRequestId = null, initialTab = "Ma bibliothèque", initialEnglishLesson = null } = props;
  const identityKey = isLoaded ? userId || "signed-out" : "auth-loading";
  const viewKey = `${identityKey}:${initialTab}:${initialFollowUp}:${initialRequestId}:${initialEnglishLesson || ""}`;
  return <LibraryContent key={viewKey} {...props}/>;
}

function LibraryContent({ initialFollowUp = null, initialRequestId = null, initialTab = "Ma bibliothèque", initialEnglishLesson = null, resources = [], isAdmin = false }) {
  const [tab, setTab] = useState(initialTab);
  const [filter, setFilter] = useState("Tout");
  const [search, setSearch] = useState("");
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const requestResult = useQuery_experimental({
    query: "clientRequests:getMyRequests",
    args: isAuthenticated ? {} : "skip",
  });
  const requests = requestResult.status === "success" ? requestResult.data : undefined;
  const deliveryResult = useQuery_experimental({
    query: "clientDeliveries:getMyDeliveries",
    args: isAuthenticated ? {} : "skip",
  });
  const deliveries = deliveryResult.status === "success" ? deliveryResult.data : undefined;
  const englishFollowUp = useQuery("bookings:getMyFollowUp", isAuthenticated ? {} : "skip");
  const followUps = resolveFollowUps(requests, englishFollowUp, initialFollowUp);
  const hasFollowUp = followUps.kinds.length > 0;
  const hasClientFollowUp = followUps.entries.some((entry) => Boolean(entry.requestId));
  const followUpReady = isAuthenticated && Array.isArray(requests) && englishFollowUp !== undefined;
  const requestStatus = resolveRequestStatus({
    authLoading,
    isAuthenticated,
    queryStatus: requestResult.status,
    connectionState,
  });
  const visible = resources
    .filter(resource => resource.id !== "english" && (filter === "Tout" || resource.collection === filter) && resource.title.toLowerCase().includes(search.toLowerCase()))
    .map(resource => ({
      resource,
      accessState: resolveResourceAccess(resource, { status: requestStatus, requests }),
    }));
  const sections = [
    ["Liées à ton accompagnement", "Découvre les fiches liées à ton achat. Leur contenu sera ajouté ici dès sa mise à disposition.", visible.filter(item => item.resource.access !== "free" && item.accessState.unlocked)],
    ["Les petits cadeaux", "À garder sous la main, quel que soit ton point de départ.", visible.filter(item => item.resource.access === "free")],
    ["Ressources supplémentaires", "Découvre les accompagnements qui donnent accès à ces contenus.", visible.filter(item => item.resource.access !== "free" && !item.accessState.unlocked)],
  ];

  return <>
    <div className="am-library-shell">
      <aside className="am-sidebar"><Brand/><p className="am-eyebrow">TON ESPACE, À TON RYTHME</p><nav aria-label="Espace personnel">{tabs.map(([name, Icon]) => <button key={name} aria-current={tab === name ? "page" : undefined} onClick={() => { setTab(name); }}><Icon size={20}/>{name}</button>)}{isAdmin && <Link className="am-sidebar-admin-link" href="/admin"><ShieldCheck size={20} aria-hidden="true"/>Administration</Link>}</nav><div className="am-sidebar-bottom"><p className="am-handnote">Un petit pas compte aussi.</p><Link href="/nouveau"><ArrowLeft size={16}/> Revenir au site</Link><div className="am-user"><span>M</span><div>Mon espace<small>Compte personnel</small></div></div></div></aside>
      <main className="am-library-main"><div className="am-library-top"><span>Mon espace / {tab}</span></div>
          {tab === "Ma bibliothèque" ? <><div className="am-library-title"><p className="am-eyebrow">DE QUOI FAIRE GRANDIR TES IDÉES</p><h1>Ma <em>bibliothèque.</em></h1><p>Des ressources gratuites pour commencer à avancer, puis les contenus liés à tes accompagnements.</p></div><div className="am-library-banner"><SparkleMark/><div><strong>Un petit cadeau pour ton prochain projet.</strong><p>Des add-ons Blender et des conseils pratiques, pour commencer à avancer ensemble.</p></div><span className="am-tag">RESSOURCES GRATUITES</span></div>{requestStatus === "error" && <p className="am-notice" role="status">Les ressources gratuites restent disponibles. Vérifie ta connexion pour afficher tes accès achetés.</p>}<div className="am-library-controls"><div className="am-filters" aria-label="Collections">{["Tout", "Portfolio", "Animation", "Anglais", "Contenu"].map(item => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="am-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Chercher une ressource" aria-label="Chercher une ressource"/></label></div>
          {!visible.length && !["Tout", "Anglais"].includes(filter) && <p className="am-empty" role="status">Aucune ressource pour cette recherche. Essaie un autre mot.</p>}
          {(filter === "Tout" || filter === "Anglais") && <EnglishLibrary search={search} initialLessonSlug={initialEnglishLesson}/>} 
          {sections.map(([title, subtitle, items]) => items.length > 0 && <section key={title} className="am-resource-section"><div className="am-resource-heading"><h2>{title} <span>{items.length.toString().padStart(2, "0")}</span></h2><p>{subtitle}</p></div><div className="am-resource-grid">{items.map(({ resource }) => <ResourceCard key={resource.id} resource={resource}/>)}</div></section>)}
        </> : tab === "Tableau de bord" ? null : tab === "Mon compte" ? <Account isAdmin={isAdmin}/> : tab === "Mon suivi" ? followUpReady && !hasFollowUp ? <section className="am-tab-preview" aria-labelledby="am-follow-empty-title"><p className="am-eyebrow">MON SUIVI</p><h1 id="am-follow-empty-title">Tout commence ici.</h1><p>Tu n’as pas encore d’accompagnement en cours. Choisis l’offre qui te correspond : ton dossier et les étapes apparaîtront ici après confirmation du paiement.</p><div className="am-follow-empty-links"><Link className="am-button" href="/nouveau/feedback">Découvrir les offres</Link><Link href="/nouveau/review">Faire analyser mon book</Link></div></section> : followUpReady ? <ProjectFollowUp initialKind={followUps.selectedKind} initialRequestId={initialRequestId} availableKinds={followUps.kinds} availableEntries={followUps.entries} deliveries={deliveries} deliveryStatus={deliveryResult.status}/> : <section className="am-tab-preview" role="status"><p>Chargement de ton suivi…</p></section> : <section className="am-tab-preview"><p className="am-eyebrow">TON ESPACE PERSONNEL</p><h1>{tab}</h1><p>Ici, ton calendrier, tes tâches et les raccourcis vers tes contenus.</p><button className="am-button" onClick={() => setTab("Ma bibliothèque")}>Retrouver ma bibliothèque</button></section>}
        <Planner active={tab === "Tableau de bord"}/>
      </main>
    </div>
  </>;
}

function ResourceCard({ resource }) {
  const accessLabel = resource.accessRule === "free"
    ? resource.downloadUrl ? "Offert" : "Bientôt disponible"
    : resource.accessRule === "purchase" ? "Payant · contenu à venir" : "Lié à une offre · contenu à venir";
  return <Link className="am-resource" href={`/nouveau/ressources/${encodeURIComponent(resource.id)}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
    <div className={`am-resource-cover am-${resource.color}`}><span className="am-cover-format">{resource.format}</span><strong>{resource.symbol}</strong><p>{resource.subtitle}</p></div>
    <div className="am-resource-body"><span className="am-resource-meta">{resource.collection} · {resource.format}</span><h3>{resource.title}</h3><span className="am-status">{accessLabel}</span><span className="am-resource-action">Découvrir <BookOpen size={16}/></span></div>
  </Link>;
}


function SparkleMark() { return <span className="am-banner-star" aria-hidden="true">✳</span>; }
