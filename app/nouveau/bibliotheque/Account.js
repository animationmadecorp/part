"use client";

import { useState } from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useConvexConnectionState, useQuery_experimental } from "convex/react";
import { ArrowRight, Database, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { businessIdentity } from "../_data/legal";
import {
  buildPurchaseHistory,
  formatHistoryDate,
  makeAccountQueryArgs,
  resolveAccountDataStatus,
} from "./accountLogic.mjs";
import "./account.css";

const sections = [
  ["profil", "Mon profil", UserRound],
  ["securite", "Connexion et sécurité", ShieldCheck],
  ["achats", "Achats et justificatifs", ReceiptText],
  ["donnees", "Mes données", Database],
];

const englishFollowUpHref = "/nouveau/bibliotheque?onglet=suivi&suivi=anglais";

export default function Account({ isAdmin = false }) {
  const { openUserProfile, signOut } = useClerk();
  const { isLoaded: clerkLoaded, isSignedIn, user } = useUser();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const accountResult = useQuery_experimental({
    query: "account:getMyPurchaseHistory",
    args: makeAccountQueryArgs({
      isAuthenticated,
      clerkLoaded,
      isSignedIn,
      userId: user?.id,
      connectionCount: connectionState.connectionCount,
    }),
  });
  const accountDataIdentityMatches = accountResult.status !== "success" || accountResult.data?.accountId === user?.id;
  const accountStatus = resolveAccountDataStatus({
    authLoading,
    isAuthenticated,
    queryStatus: accountResult.status,
    identityMatches: accountDataIdentityMatches,
    connectionState,
  });
  const purchases = accountStatus === "ready"
    ? buildPurchaseHistory({
      requests: accountResult.status === "success" ? accountResult.data?.requests : [],
      entitlements: accountResult.status === "success" ? accountResult.data?.entitlements : [],
    })
    : [];
  const profileName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Nom non renseigné";
  const profileEmail = user?.primaryEmailAddress?.emailAddress || "Adresse e-mail non renseignée";
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "?";
  const canManageAccount = clerkLoaded && Boolean(isSignedIn && user);
  const dataRequestHref = `mailto:${businessIdentity.email}?subject=${encodeURIComponent("Demande concernant mes données personnelles")}`;
  const receiptRequestHref = `mailto:${businessIdentity.email}?subject=${encodeURIComponent("Demande de justificatif de paiement")}`;
  const accountSections = isAdmin
    ? [...sections, ["administration", "Administration", ShieldCheck]]
    : sections;

  return <div className="am-account">
    <header className="am-library-title"><p className="am-eyebrow">TES INFORMATIONS ET TES CHOIX</p><h1>Mon <em>compte.</em></h1><p>Retrouve ton profil, tes achats et les réglages de ton espace.</p></header>
    <nav className="am-account-nav" aria-label="Rubriques du compte">{accountSections.map(([id, label, Icon]) => <a key={id} href={`#compte-${id}`}><Icon size={17} aria-hidden="true"/>{label}</a>)}</nav>

    <div className="am-account-grid">
      <section className="am-account-card" id="compte-profil" aria-labelledby="profil-title">
        <div className="am-account-heading"><UserRound aria-hidden="true"/><h2 id="profil-title">Mon profil</h2></div>
        <p>Tes coordonnées et ton adresse e-mail de connexion.</p>
        {!clerkLoaded ? <p className="am-account-state" role="status">Chargement de ton profil…</p> : !isSignedIn || !user ? <p className="am-account-state" role="alert">Ton profil n’est pas disponible. Reconnecte-toi pour le consulter.</p> : <>
          <div className="am-account-profile">
            <span className="am-account-avatar" aria-hidden="true">{initials}</span>
            <dl className="am-account-profile-data"><div><dt>Nom</dt><dd>{profileName}</dd></div><div><dt>E-mail</dt><dd>{profileEmail}</dd></div></dl>
          </div>
          <div className="am-account-actions"><button type="button" className="am-button" onClick={() => openUserProfile()}>Modifier mon profil</button><button type="button" className="am-account-action" onClick={() => openUserProfile({ __experimental_startPath: "/security" })}>Ouvrir les réglages</button></div>
        </>}
      </section>

      <section className="am-account-card" id="compte-securite" aria-labelledby="securite-title">
        <div className="am-account-heading"><ShieldCheck aria-hidden="true"/><h2 id="securite-title">Connexion et sécurité</h2></div>
        <p>Gère tes méthodes de connexion, tes sessions et les protections de ton espace.</p>
        <div className="am-account-row"><div><h3>Réglages de sécurité</h3><p>Mot de passe, vérifications et appareils connectés sont gérés dans ton espace sécurisé.</p></div>{canManageAccount ? <button type="button" className="am-account-action" onClick={() => openUserProfile({ __experimental_startPath: "/security" })}>Gérer la sécurité</button> : <span className="am-account-muted">Reconnecte-toi pour gérer ces réglages.</span>}</div>
        {canManageAccount ? <button type="button" className="am-account-action" onClick={() => signOut({ redirectUrl: "/nouveau" })}>Me déconnecter</button> : null}
      </section>

      {isAdmin && <section className="am-account-card am-account-wide am-account-admin" id="compte-administration" aria-labelledby="administration-title">
        <div className="am-account-heading"><ShieldCheck aria-hidden="true"/><h2 id="administration-title">Administration</h2></div>
        <p>Retrouve les demandes, les réservations, les disponibilités et les contenus de ton activité.</p>
        <div className="am-account-data-actions"><Link className="am-account-action" href="/admin">Ouvrir l’espace Administration <ArrowRight size={14} aria-hidden="true"/></Link></div>
      </section>}

      <section className="am-account-card am-account-wide" id="compte-achats" aria-labelledby="achats-title">
        <div className="am-account-heading"><ReceiptText aria-hidden="true"/><h2 id="achats-title">Achats et justificatifs</h2></div>
        <p>Retrouve tes commandes et leurs justificatifs.</p>
        {accountStatus === "loading" && <p className="am-account-state" role="status">Chargement de ton historique…</p>}
        {accountStatus === "signed-out" && <p className="am-account-state" role="alert">Connecte-toi pour consulter tes achats.</p>}
        {accountStatus === "error" && <div className="am-account-state am-account-state-error" role="alert"><p>Ton historique n’est pas disponible pour le moment. Aucun achat n’est affiché tant que la connexion n’est pas vérifiée.</p><button type="button" className="am-account-action" onClick={() => window.location.reload()}>Réessayer</button></div>}
        {accountStatus === "ready" && !purchases.length && <div className="am-account-empty"><ReceiptText size={30} aria-hidden="true"/><div><h3>Aucun achat à afficher</h3><p>Les commandes confirmées de ce compte apparaîtront ici.</p></div></div>}
        {accountStatus === "ready" && purchases.length > 0 && <ul className="am-account-purchases">{purchases.map((purchase) => <PurchaseRow key={purchase.id} purchase={purchase}/>)}</ul>}
        {accountStatus === "ready" && <p className="am-account-note"><a href={receiptRequestHref}>Demander un justificatif de paiement</a>.</p>}
      </section>

      <section className="am-account-card am-account-wide" id="compte-donnees" aria-labelledby="donnees-title">
        <div className="am-account-heading"><Database aria-hidden="true"/><h2 id="donnees-title">Mes données personnelles</h2></div>
        <p>Pour une copie, une correction ou la suppression de tes données, contacte-nous.</p>
        <div className="am-account-data-actions"><Link className="am-account-action" href="/nouveau/confidentialite">Lire la politique de confidentialité</Link><a className="am-account-action" href={dataRequestHref}>Demander une copie de mes données</a><a className="am-account-action" href={`${dataRequestHref}&body=${encodeURIComponent("Je souhaite exercer un droit concernant mes données personnelles. Merci de me confirmer la réception de ma demande.")}`}>Demander une correction ou un effacement</a></div>
        <div className="am-account-note"><h3>Besoin d’aide ?</h3><p>Pour identifier ton compte, indique l’adresse e-mail utilisée ici. N’envoie jamais de données bancaires par e-mail.</p><Link href="/nouveau/contact">Contacter Animation Made</Link></div>
      </section>
    </div>
  </div>;
}

function PurchaseRow({ purchase }) {
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const dateLabel = formatHistoryDate(purchase.date);
  const dateValue = purchase.date ? new Date(purchase.date) : null;
  const dateTime = dateValue && Number.isFinite(dateValue.getTime()) ? dateValue.toISOString() : undefined;
  const actionHref = purchase.href || (purchase.source === "booking-entitlement" ? englishFollowUpHref : null);
  const actionLabel = purchase.source === "booking-entitlement" ? "Ouvrir mon suivi" : purchase.statusKey === "paid" ? "Ouvrir mon dossier" : "Voir mon dossier";
  const canShowInvoice = ["paid", "refunded", "partial_refund"].includes(purchase.statusKey);
  async function loadInvoice() {
    setInvoiceLoading(true);
    try {
      const [kind, id] = purchase.id.split(":", 2);
      const response = await fetch(`/api/stripe/my-invoice?kind=${kind === "request" ? "request" : "entitlement"}&id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("invoice_unavailable");
      setInvoice(await response.json());
    } catch {
      setInvoice({ status: "error" });
    } finally {
      setInvoiceLoading(false);
    }
  }
  return <li className="am-account-purchase"><div className="am-account-purchase-top"><div><h3>{purchase.title}</h3><p>{purchase.detail}</p></div><div className="am-account-purchase-status"><strong>{purchase.status}</strong>{purchase.amount && <span>{purchase.amount}</span>}{dateLabel && <time dateTime={dateTime}>{dateLabel}</time>}</div></div>{actionHref && <Link className="am-account-purchase-link" href={actionHref}>{actionLabel} <ArrowRight size={14} aria-hidden="true"/></Link>}{canShowInvoice && <div className="am-account-invoice"><button type="button" className="am-account-purchase-link" onClick={loadInvoice} disabled={invoiceLoading}>{invoiceLoading ? "Recherche de la facture…" : invoice?.status === "ready" ? "Actualiser les documents" : "Voir ma facture"}</button>{invoice?.status === "ready" && <span><a href={invoice.url} target="_blank" rel="noopener noreferrer">Facture {invoice.number || ""}</a>{invoice.pdf && <> · <a href={invoice.pdf} target="_blank" rel="noopener noreferrer">PDF</a></>}{invoice.creditNotes?.map((note, index) => <span key={`${note.number || "avoir"}-${index}`}> · <a href={note.pdf} target="_blank" rel="noopener noreferrer">Avoir {note.number || ""}</a></span>)}</span>}{invoice?.status === "pending" && <span role="status">La facture est en préparation. Réessaie dans quelques instants.</span>}{invoice?.status === "unavailable" && <span role="status">Aucune facture automatique pour cet achat. Tu peux demander un justificatif ci-dessous.</span>}{invoice?.status === "error" && <span role="alert">Impossible de charger la facture. Réessaie.</span>}</div>}</li>;
}
