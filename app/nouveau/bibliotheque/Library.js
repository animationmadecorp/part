"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useConvexConnectionState, useQuery, useQuery_experimental } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, BookOpen, Check, Download, FileText, LayoutDashboard, LockKeyhole, MessageSquare, PackageCheck, Play, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { Brand } from "../_components/Shared";
import ConvexErrorBoundary from "../_components/ConvexErrorBoundary";
import Account from "./Account";
import Planner from "./Planner";
import EnglishLibrary from "./EnglishLibrary";
import ProjectFollowUp from "./ProjectFollowUp";
import { hasDeliveredLessonContent, resolveRequestStatus, resolveResourceAccess } from "./accessLogic.mjs";
import { resolveFollowUps } from "./followUpAccess.mjs";

const tabs = [["Tableau de bord", LayoutDashboard], ["Ma bibliothèque", BookOpen], ["Mon suivi", MessageSquare], ["Mon compte", UserRound]];
const OFFER_ROUTES = Object.freeze({ review: "/nouveau/review", english: "/nouveau/anglais", visibility: "/nouveau/visibilite" });
const downloadableFormats = ["Add-on", "Fiche", "E-book", "PDF"];

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
  const [opened, setOpened] = useState(null);
  const [done, setDone] = useState([]);
  const modalRef = useRef(null);
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
  const requestSnapshot = `${requestStatus}:${connectionState.connectionCount ?? "unknown"}:${JSON.stringify(requests ?? null)}`;
  const accessSnapshotFor = accessState => accessState.kind === "free" ? "free" : requestSnapshot;

  const visible = resources
    .filter(resource => resource.id !== "english" && (filter === "Tout" || resource.collection === filter) && resource.title.toLowerCase().includes(search.toLowerCase()))
    .map(resource => ({
      resource,
      accessState: resolveResourceAccess(resource, { status: requestStatus, requests }),
    }));
  const openedItem = opened ? visible.find(item => item.resource.id === opened.id) : null;
  const openedResource = openedItem?.accessState.unlocked && opened.accessSnapshot === accessSnapshotFor(openedItem.accessState)
    ? openedItem.resource
    : null;

  useEffect(() => {
    if (!openedResource) return;
    const previous = document.activeElement;
    const modal = modalRef.current;
    if (!modal) return;
    const controls = () => [...modal.querySelectorAll("button:not([disabled]), a[href], input:not([disabled])")];
    controls()[0]?.focus();
    function trap(event) {
      if (event.key === "Escape") { setOpened(null); return; }
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", trap);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [openedResource]);
  const sections = [
    ["Ton accompagnement", "Les ressources incluses dans ton accompagnement.", visible.filter(item => item.resource.access !== "free" && item.accessState.unlocked)],
    ["Les petits cadeaux", "À garder sous la main, quel que soit ton point de départ.", visible.filter(item => item.resource.access === "free")],
    ["Ressources supplémentaires", "Découvre les accompagnements qui donnent accès à ces contenus.", visible.filter(item => item.resource.access !== "free" && !item.accessState.unlocked)],
  ];

  return <>
    <div className="am-library-shell">
      <aside className="am-sidebar"><Brand/><p className="am-eyebrow">TON ESPACE, À TON RYTHME</p><nav aria-label="Espace personnel">{tabs.map(([name, Icon]) => <button key={name} aria-current={tab === name ? "page" : undefined} onClick={() => { setTab(name); setOpened(null); }}><Icon size={20}/>{name}</button>)}{isAdmin && <Link className="am-sidebar-admin-link" href="/admin"><ShieldCheck size={20} aria-hidden="true"/>Administration</Link>}</nav><div className="am-sidebar-bottom"><p className="am-handnote">Un petit pas compte aussi.</p><Link href="/nouveau"><ArrowLeft size={16}/> Revenir au site</Link><div className="am-user"><span>M</span><div>Mon espace<small>Compte gratuit</small></div></div></div></aside>
      <main className="am-library-main"><div className="am-library-top"><span>Mon espace / {tab}</span></div>
          {tab === "Ma bibliothèque" ? <><div className="am-library-title"><p className="am-eyebrow">DE QUOI FAIRE GRANDIR TES IDÉES</p><h1>Ma <em>bibliothèque.</em></h1><p>Des ressources gratuites pour commencer à avancer, puis les contenus liés à tes accompagnements.</p></div><div className="am-library-banner"><SparkleMark/><div><strong>Un petit cadeau pour ton prochain projet.</strong><p>Des add-ons Blender et des conseils pratiques, pour commencer à avancer ensemble.</p></div><span className="am-tag">RESSOURCES GRATUITES</span></div>{requestStatus === "error" && <p className="am-notice" role="status">Les ressources gratuites restent disponibles. Vérifie ta connexion pour afficher tes accès achetés.</p>}<div className="am-library-controls"><div className="am-filters" aria-label="Collections">{["Tout", "Portfolio", "Animation", "Anglais", "Contenu"].map(item => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="am-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Chercher une ressource" aria-label="Chercher une ressource"/></label></div>
          {!visible.length && !["Tout", "Anglais"].includes(filter) && <p className="am-empty" role="status">Aucune ressource pour cette recherche. Essaie un autre mot.</p>}
          {(filter === "Tout" || filter === "Anglais") && <EnglishLibrary search={search} initialLessonSlug={initialEnglishLesson}/>} 
          {sections.map(([title, subtitle, items]) => items.length > 0 && <section key={title} className="am-resource-section"><div className="am-resource-heading"><h2>{title} <span>{items.length.toString().padStart(2, "0")}</span></h2><p>{subtitle}</p></div><div className="am-resource-grid">{items.map(({ resource, accessState }) => <ResourceCard key={resource.id} resource={resource} accessState={accessState} completed={done.includes(resource.id)} onOpen={() => setOpened({ id: resource.id, accessSnapshot: accessSnapshotFor(accessState) })}/>)}</div></section>)}
        </> : tab === "Tableau de bord" ? null : tab === "Mon compte" ? <Account isAdmin={isAdmin}/> : tab === "Mon suivi" ? followUpReady && !hasFollowUp ? <section className="am-tab-preview" aria-labelledby="am-follow-empty-title"><p className="am-eyebrow">MON SUIVI</p><h1 id="am-follow-empty-title">Tout commence ici.</h1><p>Tu n’as pas encore d’accompagnement en cours. Choisis l’offre qui te correspond : ton dossier et les étapes apparaîtront ici après confirmation du paiement.</p><div className="am-follow-empty-links"><Link className="am-button" href="/nouveau/feedback">Découvrir les offres</Link><Link href="/nouveau/review">Faire analyser mon book</Link></div></section> : followUpReady ? <ProjectFollowUp initialKind={followUps.selectedKind} initialRequestId={initialRequestId} availableKinds={followUps.kinds} availableEntries={followUps.entries} deliveries={deliveries} deliveryStatus={deliveryResult.status}/> : <section className="am-tab-preview" role="status"><p>Chargement de ton suivi…</p></section> : <section className="am-tab-preview"><p className="am-eyebrow">TON ESPACE PERSONNEL</p><h1>{tab}</h1><p>Ici, ton calendrier, tes tâches et les raccourcis vers tes contenus.</p><button className="am-button" onClick={() => setTab("Ma bibliothèque")}>Retrouver ma bibliothèque</button></section>}
        <Planner active={tab === "Tableau de bord"}/>
      </main>
    </div>
    {openedResource && <ResourceDialog resource={openedResource} completed={done.includes(openedResource.id)} modalRef={modalRef} onClose={() => setOpened(null)} onComplete={() => setDone(current => current.includes(openedResource.id) ? current : [...current, openedResource.id])}/>} 
  </>;
}

function ResourceCard({ resource, accessState, completed, onOpen }) {
  const accessible = accessState.unlocked;
  const delivered = hasDeliveredLessonContent(resource);
  const action = completed ? "Ouvrir" : resource.progress && delivered ? "Continuer" : "Voir le détail";
  const status = !accessible
    ? ["unavailable", "loading"].includes(accessState.kind)
      ? "Accès à vérifier"
      : accessState.kind === "separate-model"
        ? "Voir dans Mon suivi"
        : "Verrouillé"
    : accessState.kind === "purchased" && !delivered
      ? "Achat confirmé · contenu à venir"
      : completed
        ? "Terminé"
        : resource.progress
          ? "À continuer"
          : "Accessible";
  const offerHref = OFFER_ROUTES[resource.access] || "/nouveau";
  return <article className="am-resource"><div className={`am-resource-cover am-${resource.color}`}><span className="am-cover-format">{resource.format}</span><strong>{resource.symbol}</strong><p>{resource.subtitle}</p>{!accessible && ["locked", "separate-model"].includes(accessState.kind) && <span className="am-lock"><LockKeyhole size={16}/></span>}</div><div className="am-resource-body"><span className="am-resource-meta">{resource.collection} · {resource.format}</span><h3>{resource.title}</h3><span className="am-status">{status}</span>{accessible && resource.progress && delivered && !completed && <div className="am-progress" aria-label={`Progression ${resource.progress} %`}><span style={{ width: `${resource.progress}%` }}/></div>}{accessible ? <button className="am-resource-action" onClick={onOpen}>{action}<BookOpen size={16}/></button> : ["unavailable", "loading"].includes(accessState.kind) ? <button className="am-resource-action" type="button" disabled>Accès à vérifier</button> : <Link className="am-resource-action" href={accessState.kind === "separate-model" ? "/nouveau/bibliotheque?onglet=suivi&suivi=anglais" : offerHref}>{accessState.kind === "separate-model" ? "Voir mon suivi" : "Découvrir l’offre"} <LockKeyhole size={15}/></Link>}</div></article>;
}

function ResourceDialog({ resource, completed, modalRef, onClose, onComplete }) {
  const isLesson = resource.format === "Leçon" || resource.format === "Article";
  const isPdf = resource.format === "Fiche" || resource.format === "E-book" || resource.format === "PDF";
  const isAddon = resource.format === "Add-on";
  const isVideo = resource.format === "Vidéo";
  const publicDownload = isAddon && resource.accessRule === "free" && resource.downloadUrl;
  const hasLessonContent = hasDeliveredLessonContent(resource);
  return <div className="am-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="am-dialog-title" aria-describedby="am-dialog-description" className={`am-modal am-resource-dialog am-${resource.color}`}><button className="am-modal-close" onClick={onClose} aria-label="Fermer"><X/></button><header className="am-dialog-header"><span className="am-dialog-format">{resource.format}</span><span className="am-eyebrow">{resource.collection}</span><h2 id="am-dialog-title">{resource.title}</h2><p id="am-dialog-description">{resource.description}</p></header><dl className="am-dialog-meta">{resource.metadata?.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
      {isLesson && hasLessonContent ? <div className="am-lesson-content">{resource.content.map((section, index) => <section key={section.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{section.title}</h3><p>{section.text}</p></div></section>)}</div> : isLesson ? <div className="am-format-summary"><BookOpen aria-hidden="true"/><div><strong>Contenu en préparation</strong><p>Ton accès est bien identifié, mais le contenu n’est pas encore remis dans cet espace.</p></div></div> : null}
      {isPdf && <div className="am-format-summary"><FileText aria-hidden="true"/><div><strong>À lire à ton rythme</strong><p>Retrouve les repères essentiels dans un format pensé pour être gardé sous la main.</p></div></div>}
      {isAddon && <div className="am-format-summary"><PackageCheck aria-hidden="true"/><div><strong>Prêt à ajouter à ton workflow</strong><p>Installe-le depuis les préférences de Blender, puis active-le dans ta liste d’add-ons.</p></div></div>}
      {publicDownload && <div className="am-dialog-actions"><a className="am-button" href={publicDownload} download><Download size={17}/>Télécharger le ZIP</a>{resource.presentationSlug && <Link href={`/nouveau/articles/${resource.presentationSlug}`}>Voir la présentation et les images</Link>}</div>}
      {isVideo && <div className="am-video-placeholder"><Play aria-hidden="true"/><span>La vidéo sera accessible depuis cet espace.</span></div>}
      <div className="am-dialog-actions">{isLesson ? <button className="am-button" disabled={!hasLessonContent || completed} onClick={onComplete}><Check size={17}/>{!hasLessonContent ? "Bientôt disponible" : completed ? "Leçon terminée" : "Marquer comme terminé"}</button> : isVideo ? <button className="am-button" type="button" disabled><Play size={17}/>Bientôt disponible</button> : !publicDownload && downloadableFormats.includes(resource.format) ? <button className="am-button" type="button" disabled><Download size={17}/>Téléchargement après remise</button> : null}<button className="am-text-button" onClick={onClose}>Retour à la bibliothèque</button></div>
    </section></div>;
}

function SparkleMark() { return <span className="am-banner-star" aria-hidden="true">✳</span>; }
