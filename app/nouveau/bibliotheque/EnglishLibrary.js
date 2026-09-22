"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronRight, LockKeyhole, X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useConvexConnectionState, useMutation, useQuery_experimental } from "convex/react";
import EnglishLessonBody from "../../../components/EnglishLessonBody";
import "./english-library.css";

function resultIsPending(result) {
  return result?.status === "pending" || result?.status === "loading";
}

function resultIsError(result) {
  return result?.status === "error";
}

function lessonNumber(index) {
  return String(index + 1).padStart(2, "0");
}

export default function EnglishLibrary({ search = "", initialLessonSlug = null }) {
  const { isLoaded: clerkLoaded, userId: clerkUserId } = useAuth();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const [selectedSlug, setSelectedSlug] = useState(initialLessonSlug);
  const initialOpened = useRef(false);
  const currentIdentityRef = useRef(clerkUserId || null);
  const lessonButtonRefs = useRef(new Map());
  const readerRef = useRef(null);
  const readerHeadingRef = useRef(null);
  const focusedSlugRef = useRef(null);
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const lessonsResult = useQuery_experimental({
    query: "englishLessons:getMyEnglishLessons",
    args: isAuthenticated ? {} : "skip",
  });
  const lessonData = lessonsResult.status === "success" ? lessonsResult.data : null;
  const viewerMatches = Boolean(lessonData?.viewerId && clerkUserId && lessonData.viewerId === clerkUserId);
  const accessGranted = lessonsResult.status === "success" && viewerMatches && lessonData?.access === "granted";
  const lessonResult = useQuery_experimental({
    query: "englishLessons:getMyEnglishLesson",
    args: isAuthenticated && accessGranted && selectedSlug ? { slug: selectedSlug } : "skip",
  });
  const recordOpened = useMutation("englishLessons:recordLessonOpened");
  const setCompleted = useMutation("englishLessons:setLessonCompleted");

  const connectionLost = connectionState.hasEverConnected && connectionState.isWebSocketConnected === false;
  const filteredLessons = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr-FR");
    if (!normalizedSearch) return lessonData?.lessons || [];
    return (lessonData?.lessons || []).filter((lesson) =>
      [lesson.title, lesson.category, lesson.slug]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("fr-FR").includes(normalizedSearch)),
    );
  }, [lessonData, search]);

  const selectedSummary = lessonData?.lessons?.find((lesson) => lesson.slug === selectedSlug) || null;
  const selectedLesson = lessonResult.status === "success" && lessonResult.data?.viewerId === clerkUserId && lessonResult.data?.access === "granted"
    ? lessonResult.data.lesson
    : null;
  const lastOpenedLesson = lessonData?.lastOpenedSlug
    ? lessonData.lessons?.find((lesson) => lesson.slug === lessonData.lastOpenedSlug) || null
    : null;

  useEffect(() => {
    currentIdentityRef.current = clerkUserId || null;
  }, [clerkUserId]);

  useEffect(() => {
    initialOpened.current = false;
    focusedSlugRef.current = null;
  }, [clerkUserId, initialLessonSlug]);

  useEffect(() => {
    if (!initialLessonSlug || !accessGranted || initialOpened.current) return;
    initialOpened.current = true;
    recordOpened({ slug: initialLessonSlug }).catch(() => {
      setActionError("La leçon s’est ouverte, mais sa reprise n’a pas pu être enregistrée.");
    });
  }, [accessGranted, initialLessonSlug, recordOpened]);

  useEffect(() => {
    if (!selectedSlug || !selectedLesson || focusedSlugRef.current === selectedSlug) return undefined;
    let committed = false;
    const frame = window.requestAnimationFrame(() => {
      readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      readerHeadingRef.current?.focus({ preventScroll: true });
      committed = true;
      focusedSlugRef.current = selectedSlug;
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (!committed && focusedSlugRef.current === selectedSlug) focusedSlugRef.current = null;
    };
  }, [selectedLesson, selectedSlug]);

  function isCurrentIdentity(operationIdentity) {
    return currentIdentityRef.current === operationIdentity;
  }

  async function openLesson(slug) {
    const operationIdentity = clerkUserId;
    setSelectedSlug(slug);
    setActionError("");
    try {
      await recordOpened({ slug });
    } catch {
      if (isCurrentIdentity(operationIdentity)) {
        setActionError("La leçon s’est ouverte, mais sa reprise n’a pas pu être enregistrée.");
      }
    }
  }

  async function toggleCompleted() {
    if (!selectedLesson || actionPending) return;
    const operationIdentity = clerkUserId;
    setActionPending(true);
    setActionError("");
    try {
      await setCompleted({
        slug: selectedLesson.slug,
        completed: !selectedLesson.progress?.completed,
      });
    } catch {
      if (isCurrentIdentity(operationIdentity)) {
        setActionError("La progression n’a pas pu être enregistrée. Réessaie dans un instant.");
      }
    } finally {
      if (isCurrentIdentity(operationIdentity)) setActionPending(false);
    }
  }

  function closeLesson() {
    const slug = selectedSlug;
    setSelectedSlug(null);
    focusedSlugRef.current = null;
    if (slug) window.requestAnimationFrame(() => lessonButtonRefs.current.get(slug)?.focus());
  }

  if (authLoading || !clerkLoaded) {
    return <section className="am-english-library" aria-live="polite"><p className="am-english-state">Chargement de tes leçons…</p></section>;
  }

  if (!isAuthenticated) {
    return <section className="am-english-library am-english-library-locked" aria-labelledby="am-english-locked-title"><LockKeyhole aria-hidden="true"/><div><p className="am-eyebrow">ANGLAIS · ESPACE PRIVÉ</p><h2 id="am-english-locked-title">Tes leçons sont réservées à ton espace.</h2><p>Connecte-toi pour vérifier ton accès après un achat.</p></div></section>;
  }

  if (connectionLost || resultIsError(lessonsResult)) {
    return <section className="am-english-library am-english-library-error" role="status"><BookOpen aria-hidden="true"/><div><p className="am-eyebrow">ANGLAIS · ACCÈS À VÉRIFIER</p><h2>Ta bibliothèque anglaise est momentanément indisponible.</h2><p>Réessaie lorsque la connexion à ton espace sera rétablie.</p></div></section>;
  }

  if (lessonsResult.status === "success" && !viewerMatches) {
    return <section className="am-english-library" aria-live="polite"><p className="am-english-state">Vérification de ton identité…</p></section>;
  }

  if (resultIsPending(lessonsResult) || !lessonData) {
    return <section className="am-english-library" aria-live="polite"><p className="am-english-state">Vérification de ton accès anglais…</p></section>;
  }

  if (lessonData.access !== "granted") {
    return <section className="am-english-library am-english-library-locked" aria-labelledby="am-english-purchase-title"><LockKeyhole aria-hidden="true"/><div><p className="am-eyebrow">ANGLAIS · TA BIBLIOTHÈQUE</p><h2 id="am-english-purchase-title">Tes leçons t’attendent ici.</h2><p>17 leçons pour t’entraîner, incluses dès ton premier cours d’anglais.</p><Link className="am-english-link" href="/nouveau/anglais">Découvrir les cours <ChevronRight size={15} aria-hidden="true"/></Link></div></section>;
  }

  return <section className="am-english-library" aria-labelledby="am-english-library-title">
    <header className="am-english-library-header">
      <div>
        <p className="am-eyebrow">ANGLAIS · TA BIBLIOTHÈQUE</p>
        <h2 id="am-english-library-title">Les leçons <em>pour continuer.</em></h2>
        <p>Les explications déjà disponibles, avec ta progression conservée dans ton espace.</p>
      </div>
      <div className="am-english-library-header-actions"><div className="am-english-progress" role="status"><strong>{lessonData.completedCount}/{lessonData.lessonCount}</strong><span>leçons terminées</span></div>{lastOpenedLesson ? <button className="am-english-resume" type="button" onClick={() => openLesson(lastOpenedLesson.slug)}>Reprendre : {lastOpenedLesson.title}</button> : null}</div>
    </header>

    {filteredLessons.length ? <div className="am-english-lesson-grid">{filteredLessons.map((lesson) => {
      const index = lessonData.lessons.findIndex((item) => item.slug === lesson.slug);
      const completed = lesson.progress?.completed === true;
      return <button className="am-english-lesson-card" type="button" key={lesson.slug} ref={(element) => { if (element) lessonButtonRefs.current.set(lesson.slug, element); else lessonButtonRefs.current.delete(lesson.slug); }} aria-current={selectedSlug === lesson.slug ? "true" : undefined} aria-expanded={selectedSlug === lesson.slug} onClick={() => openLesson(lesson.slug)}>
        <span className="am-english-lesson-number">{lessonNumber(index)}</span>
        <span className="am-english-lesson-copy"><small>{lesson.category}</small><strong>{lesson.title}</strong><span>{completed ? "Terminée" : lesson.progress?.lastOpenedAt ? "À reprendre" : "À découvrir"}</span></span>
        <span className={`am-english-lesson-check${completed ? " is-complete" : ""}`}>{completed ? <Check size={17} aria-label="Terminée"/> : <ChevronRight size={17} aria-hidden="true"/>}</span>
      </button>;
    })}</div> : <p className="am-english-state">Aucune leçon ne correspond à cette recherche.</p>}

    {selectedSlug && <article ref={readerRef} className="am-english-reader" aria-labelledby="am-english-reader-title">
      <button className="am-english-reader-close" type="button" onClick={closeLesson} aria-label="Fermer la leçon"><X size={18}/></button>
      {resultIsError(lessonResult) ? <p className="am-english-state" role="status">Cette leçon n’est pas disponible pour le moment.</p> : resultIsPending(lessonResult) || !selectedLesson ? <p className="am-english-state" role="status">Ouverture de la leçon…</p> : <>
        <p className="am-eyebrow">{selectedLesson.category}</p>
        <h3 id="am-english-reader-title" ref={readerHeadingRef} tabIndex={-1}>{selectedLesson.title}</h3>
        <div className="am-english-reader-body"><EnglishLessonBody>{selectedLesson.body}</EnglishLessonBody></div>
        <div className="am-english-reader-actions"><button className="am-button" type="button" onClick={toggleCompleted} disabled={actionPending}><Check size={17}/>{actionPending ? "Enregistrement…" : selectedLesson.progress?.completed ? "Marquée comme terminée" : "Marquer comme terminée"}</button>{selectedSummary?.progress?.lastOpenedAt ? <span>Ta reprise est enregistrée.</span> : null}</div>
      </>}
      {actionError ? <p className="am-english-action-error" role="status">{actionError}</p> : null}
    </article>}
  </section>;
}
