"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

const REVALIDATION_COOLDOWN_MS = 5000;
const hasClerkProvider = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const MESSAGES = {
  configuration_required: {
    title: "Cet espace privé doit encore être configuré.",
    body: "Clerk et Convex ne sont pas encore reliés à cet environnement de développement. Aucun compte fictif n’est utilisé.",
  },
  unavailable: {
    title: "Cet espace privé est momentanément indisponible.",
    body: "La connexion sécurisée ou le profil métier n’a pas pu être vérifié. Réessaie après configuration du développement.",
  },
  unauthenticated: {
    title: "Connecte-toi pour continuer.",
    body: "Cette zone nécessite une identité vérifiée.",
  },
  forbidden: {
    title: "Accès administrateur requis.",
    body: "Cette zone est réservée à un profil administrateur vérifié côté serveur.",
  },
};

function BoundaryMessage({ reason, revalidating = false }) {
  const message = MESSAGES[reason] || MESSAGES.unavailable;

  return (
    <section className="am-access-boundary am-container" aria-live="polite">
      <p className="am-eyebrow">Espace privé</p>
      <h1>{revalidating ? "Vérification de ta connexion…" : message.title}</h1>
      <p className="am-lead">{revalidating ? "Nous actualisons cette page après la restauration de ta session sécurisée." : message.body}</p>
      {reason === "unauthenticated" && !revalidating ? (
        <Link className="am-button" href="/sign-in">
          Se connecter
        </Link>
      ) : null}
      {reason === "forbidden" ? (
        <Link className="am-button am-outline" href="/nouveau">
          Retour au site
        </Link>
      ) : null}
    </section>
  );
}

function RevalidatingAccessBoundary({ reason }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const attempted = useRef(false);
  const [revalidating, setRevalidating] = useState(false);
  useEffect(() => {
    if (reason !== "unauthenticated" || !isLoaded || !isSignedIn || attempted.current) return;

    const key = `am-server-auth-revalidation:${window.location.pathname}:${sessionId || "active"}`;
    let lastAttempt = 0;
    try {
      lastAttempt = Number(window.sessionStorage.getItem(key) || 0);
    } catch {}
    const now = Date.now();
    attempted.current = true;
    if (Number.isFinite(lastAttempt) && now - lastAttempt < REVALIDATION_COOLDOWN_MS) return;

    try {
      window.sessionStorage.setItem(key, String(now));
    } catch {}
    setRevalidating(true);
    router.refresh();
    const timeout = window.setTimeout(() => setRevalidating(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [isLoaded, isSignedIn, reason, router, sessionId]);

  return <BoundaryMessage reason={reason} revalidating={revalidating} />;
}

export default function AccessBoundary({ reason = "unavailable" }) {
  // A local build without Clerk configuration still renders public/admin
  // refusal pages. Only the configured Clerk tree may call Clerk hooks.
  if (!hasClerkProvider || reason !== "unauthenticated") {
    return <BoundaryMessage reason={reason} />;
  }
  return <RevalidatingAccessBoundary reason={reason} />;
}
