"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useConvexAuth, useConvexConnectionState, useMutation, useQuery_experimental } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { ChevronLeft, ChevronRight, Plus, Printer, Trash2, X } from "lucide-react";
import {
  dateFromKey,
  dateKey,
  dayDifference,
  isValidDateKey,
  isValidTime,
  occurrenceFor,
} from "../../../convex/plannerRules.js";
import "./planner.css";

const names = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
let plannerClockSnapshot = Date.now();

function subscribePlannerClock(onChange) {
  const timer = window.setInterval(() => {
    plannerClockSnapshot = Date.now();
    onChange();
  }, 30_000);
  return () => window.clearInterval(timer);
}

const getPlannerClock = () => plannerClockSnapshot;
const getPlannerServerClock = () => 0;

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function monday(offset) {
  const result = startOfWeek(new Date());
  result.setDate(result.getDate() + offset * 7);
  return result;
}

function weekOffsetForDate(value) {
  const target = dateKey(startOfWeek(dateFromKey(value)));
  const current = dateKey(startOfWeek(new Date()));
  return Math.round(dayDifference(current, target) / 7);
}

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function formatTime(time) {
  return time ? time.replace(":", " h") : "";
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyDraft() {
  const now = new Date();
  return { title: "", subtitle: "", date: dateKey(now), time: "", recurring: false };
}

function appointmentStatusLabel(status) {
  return status === "pending" ? "Paiement en vérification" : "Confirmé";
}

function isVisibleEnglishAppointment(booking, now) {
  if (!booking || booking.offerKey !== "anglais") return false;
  if (!["pending", "confirmed"].includes(booking.status)) return false;
  if (booking.status === "pending" && now > 0 && Number(booking.holdExpiresAt) <= now) return false;
  return isValidDateKey(booking.date) && isValidTime(booking.time) && booking.time !== "";
}

export default function Planner({ active }) {
  const { isLoaded: clerkLoaded, userId: clerkUserId } = useAuth();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const identityRef = useRef(clerkUserId);
  const identityGenerationRef = useRef(0);
  // This render-time epoch invalidates an old mutation before passive effects
  // run, which is required during an A→B identity transition.
  /* eslint-disable react-hooks/refs */
  if (identityRef.current !== clerkUserId) {
    identityRef.current = clerkUserId;
    identityGenerationRef.current += 1;
  }
  const identityGeneration = identityGenerationRef.current;
  /* eslint-enable react-hooks/refs */
  const [identitySettledUserId, setIdentitySettledUserId] = useState(null);
  const identityReady = clerkLoaded && Boolean(clerkUserId) && identitySettledUserId === clerkUserId;
  const queryArgs = active && isAuthenticated && identityReady ? {} : "skip";
  const taskResult = useQuery_experimental({ query: "planner:getMyTasks", args: queryArgs });
  const appointmentResult = useQuery_experimental({ query: "planner:getMyAppointments", args: queryArgs });
  const createTaskMutation = useMutation("planner:createTask");
  const setOccurrenceCompletedMutation = useMutation("planner:setOccurrenceCompleted");
  const deleteOccurrenceMutation = useMutation("planner:deleteOccurrence");

  const [weekOffset, setWeekOffset] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [draftOwnerUserId, setDraftOwnerUserId] = useState(null);
  const [draftOwnerGeneration, setDraftOwnerGeneration] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogOwnerUserId, setDialogOwnerUserId] = useState(null);
  const [dialogOwnerGeneration, setDialogOwnerGeneration] = useState(null);
  const [status, setStatus] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [pendingActionKey, setPendingActionKey] = useState(null);
  const clockNow = useSyncExternalStore(subscribePlannerClock, getPlannerClock, getPlannerServerClock);
  const dialogRef = useRef(null);
  const addButtonRef = useRef(null);
  const lastTriggerRef = useRef(null);
  const lastTriggerIdentityRef = useRef(null);

  function isCurrentIdentity(userId, generation) {
    return identityRef.current === userId && identityGenerationRef.current === generation;
  }

  const weekStart = monday(weekOffset);
  const days = names.map((name, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return { name, date, id: dateKey(date) };
  });

  const connectionFailure = connectionState.hasEverConnected && connectionState.isWebSocketConnected === false;
  const taskViewerMatches = taskResult.data?.viewerId === clerkUserId;
  const appointmentViewerMatches = appointmentResult.data?.viewerId === clerkUserId;
  const taskDataReady = identityReady && taskResult.status === "success" && !connectionFailure && taskViewerMatches;
  const appointmentDataReady = identityReady && appointmentResult.status === "success" && !connectionFailure && appointmentViewerMatches;
  const identityTransition = active && isAuthenticated && !identityReady;
  const taskQueryError = active && isAuthenticated && !identityTransition && (taskResult.status === "error" || connectionFailure);
  const appointmentQueryError = active && isAuthenticated && !identityTransition && (appointmentResult.status === "error" || connectionFailure);
  const tasks = taskDataReady && Array.isArray(taskResult.data?.tasks) ? taskResult.data.tasks : [];
  const appointments = appointmentDataReady && Array.isArray(appointmentResult.data?.bookings)
    ? appointmentResult.data.bookings.filter((booking) => isVisibleEnglishAppointment(booking, clockNow))
    : [];
  const taskLoading = active && isAuthenticated && !identityTransition && !taskQueryError && !taskDataReady;
  const appointmentLoading = active && isAuthenticated && !identityTransition && !appointmentQueryError && !appointmentDataReady;
  const formIdentityMatches = identityReady
    && draftOwnerUserId === clerkUserId
    && draftOwnerGeneration === identityGeneration
    && dialogOwnerUserId === clerkUserId
    && dialogOwnerGeneration === identityGeneration;
  const visibleDraft = formIdentityMatches ? draft : emptyDraft();
  const dialogVisible = dialogOpen && formIdentityMatches;
  const queryStatus = !active
    ? ""
    : authLoading
      ? "Connexion à ton espace…"
      : !isAuthenticated
        ? "Connecte-toi pour retrouver ton semainier."
        : identityTransition
          ? "Vérification de ton compte…"
        : taskQueryError
          ? "Ton semainier est momentanément indisponible. Aucune modification n’a été appliquée."
          : taskLoading
            ? "Chargement de ton semainier…"
            : appointmentQueryError
              ? "Tes rendez-vous anglais ne sont pas disponibles pour le moment."
              : appointmentLoading
                ? "Chargement de tes rendez-vous…"
                : "";
  const editDisabled = !active || authLoading || !isAuthenticated || !identityReady || !taskDataReady || Boolean(pendingActionKey);
  const displayedStatus = queryStatus || status;
  const weekAppointments = appointments.filter((booking) => days.some((day) => day.id === booking.date));
  const currentOccurrences = days.flatMap((day) =>
    tasks.map((task) => occurrenceFor(task, day.id)).filter(Boolean),
  );

  useEffect(() => {
    // The query is skipped until this settles, so an A→B Clerk transition
    // cannot briefly render A's cached private result in B's library.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentitySettledUserId(clerkLoaded ? clerkUserId || null : null);
    // An open form and its pending state belong to the previous identity.
    // Reset them at the same boundary that invalidates the cached queries.
    setDraft(emptyDraft());
    setDraftOwnerUserId(null);
    setDraftOwnerGeneration(null);
    setDialogOpen(false);
    setDialogOwnerUserId(null);
    setDialogOwnerGeneration(null);
    setDialogError("");
    setPendingActionKey(null);
    setStatus("");
    lastTriggerRef.current = null;
    lastTriggerIdentityRef.current = null;
  }, [clerkLoaded, clerkUserId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (dialogVisible) {
      if (!dialog.open) dialog.showModal();
      dialog.querySelector("[name=title]")?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [dialogVisible]);

  useEffect(() => {
    if (!active && dialogRef.current?.open) dialogRef.current.close();
  }, [active]);

  function updateDraft(field, value) {
    if (!formIdentityMatches) return;
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function openTaskDialog(event) {
    if (editDisabled) return;
    lastTriggerRef.current = event.currentTarget;
    lastTriggerIdentityRef.current = { userId: clerkUserId, generation: identityGeneration };
    setDraft(emptyDraft());
    setDraftOwnerUserId(clerkUserId);
    setDraftOwnerGeneration(identityGeneration);
    setStatus("");
    setDialogError("");
    setDialogOwnerUserId(clerkUserId);
    setDialogOwnerGeneration(identityGeneration);
    setDialogOpen(true);
  }

  function closeTaskDialog() {
    setDialogOpen(false);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    const closeUserId = identityRef.current;
    const closeGeneration = identityGenerationRef.current;
    const trigger = lastTriggerRef.current;
    const triggerIdentity = lastTriggerIdentityRef.current;
    if (!triggerIdentity || !isCurrentIdentity(triggerIdentity.userId, triggerIdentity.generation)) return;
    requestAnimationFrame(() => {
      if (isCurrentIdentity(closeUserId, closeGeneration)) trigger?.focus();
    });
  }

  function handleDialogCancel(event) {
    event.preventDefault();
    closeTaskDialog();
  }

  async function addTask(event) {
    event.preventDefault();
    if (editDisabled || !dialogVisible) return;
    const operationUserId = identityRef.current;
    const operationGeneration = identityGenerationRef.current;
    const title = visibleDraft.title.trim();
    const subtitle = visibleDraft.subtitle.trim();
    if (!title || !isValidDateKey(visibleDraft.date) || !isValidTime(visibleDraft.time)) {
      setDialogError("Vérifie le titre, le jour et l’heure de ta tâche.");
      return;
    }

    setPendingActionKey("create");
    setStatus("Enregistrement de ta tâche…");
    setDialogError("");
    const task = {
      clientId: makeId(),
      title,
      subtitle,
      date: visibleDraft.date,
      time: visibleDraft.time,
      recurring: visibleDraft.recurring,
    };
    try {
      await createTaskMutation(task);
      if (!isCurrentIdentity(operationUserId, operationGeneration)) return;
      setWeekOffset(weekOffsetForDate(task.date));
      setStatus(task.recurring ? "Tâche enregistrée et répétée chaque semaine." : "Tâche enregistrée dans ton semainier.");
      setDialogError("");
      closeTaskDialog();
    } catch {
      if (!isCurrentIdentity(operationUserId, operationGeneration)) return;
      const message = "La tâche n’a pas pu être enregistrée. Réessaie quand la connexion sera revenue.";
      setDialogError(message);
      setStatus(message);
    } finally {
      if (isCurrentIdentity(operationUserId, operationGeneration)) setPendingActionKey(null);
    }
  }

  async function toggleOccurrence(taskId, occurrenceDate, done) {
    if (editDisabled) return;
    const operationUserId = identityRef.current;
    const operationGeneration = identityGenerationRef.current;
    setPendingActionKey(`complete:${taskId}:${occurrenceDate}`);
    setStatus("Enregistrement de la coche…");
    try {
      await setOccurrenceCompletedMutation({ taskId, occurrenceDate, completed: !done });
      if (!isCurrentIdentity(operationUserId, operationGeneration)) return;
      setStatus(done ? "Tâche rouverte." : "Tâche cochée.");
    } catch {
      if (!isCurrentIdentity(operationUserId, operationGeneration)) return;
      setStatus("La coche n’a pas pu être enregistrée. Réessaie quand la connexion sera revenue.");
    } finally {
      if (isCurrentIdentity(operationUserId, operationGeneration)) setPendingActionKey(null);
    }
  }

  async function deleteOccurrence(taskId, occurrenceDate) {
    if (editDisabled) return;
    const operationUserId = identityRef.current;
    const operationGeneration = identityGenerationRef.current;
    setPendingActionKey(`delete:${taskId}:${occurrenceDate}`);
    setStatus("Suppression de l’occurrence…");
    try {
      const result = await deleteOccurrenceMutation({ taskId, occurrenceDate });
      if (!isCurrentIdentity(operationUserId, operationGeneration)) return;
      setStatus(result.status === "deleted_task"
        ? "Tâche supprimée."
        : "Occurrence supprimée. Les autres semaines restent inchangées.");
    } catch {
      if (!isCurrentIdentity(operationUserId, operationGeneration)) return;
      setStatus("La suppression n’a pas pu être enregistrée. Réessaie quand la connexion sera revenue.");
    } finally {
      if (isCurrentIdentity(operationUserId, operationGeneration)) setPendingActionKey(null);
    }
  }

  return <div className="am-planner" hidden={!active}>
    <header className="am-library-title">
      <p className="am-eyebrow">UN PEU DE PLACE POUR TES PROJETS</p>
      <h1>Ma <em>semaine.</em></h1>
      <p>Tes tâches, au même endroit. À ton rythme.</p>
    </header>

    <div className="am-planner-toolbar">
      <div className="am-planner-week" aria-label="Navigation entre les semaines">
        <button type="button" aria-label="Semaine précédente" onClick={() => setWeekOffset((offset) => offset - 1)}><ChevronLeft size={20} /></button>
        <h2>{formatDate(days[0].date)} — {formatDate(days[6].date)} {days[6].date.getFullYear()}</h2>
        <button type="button" aria-label="Semaine suivante" onClick={() => setWeekOffset((offset) => offset + 1)}><ChevronRight size={20} /></button>
      </div>
      <div className="am-planner-actions">
        <button type="button" className="am-planner-save" onClick={() => window.print()}><Printer size={17} />Imprimer / Enregistrer</button>
        <button ref={addButtonRef} type="button" className="am-button am-planner-add" onClick={openTaskDialog} disabled={editDisabled}><Plus size={18} />Ajouter une tâche</button>
      </div>
    </div>

    <p className="am-planner-status" role="status" aria-live="polite">{displayedStatus}</p>
    <div className="am-planner-summary">
      <span>{currentOccurrences.length} tâche{currentOccurrences.length > 1 ? "s" : ""} · {currentOccurrences.filter((occurrence) => occurrence.done).length} terminée{currentOccurrences.filter((occurrence) => occurrence.done).length > 1 ? "s" : ""}</span>
      {weekAppointments.length ? <span>{weekAppointments.length} rendez-vous anglais</span> : null}
    </div>

    <div className="am-planner-sheet">
      <div className="am-planner-print-title">animationmade. · Mon semainier</div>
      <div className="am-planner-days">
        {days.map((day) => {
          const dayTasks = tasks
            .map((task) => occurrenceFor(task, day.id))
            .filter(Boolean)
            .map((occurrence) => ({
              kind: "task",
              key: `${occurrence.task.id}-${occurrence.date}`,
              time: occurrence.task.time || "99:99",
              occurrence,
            }));
          const dayAppointments = appointments
            .filter((booking) => booking.date === day.id)
            .map((booking) => ({
              kind: "appointment",
              key: `appointment-${booking.id}`,
              time: booking.time,
              booking,
            }));
          const entries = [...dayAppointments, ...dayTasks]
            .sort((first, second) => first.time.localeCompare(second.time));

          return <section className="am-planner-day" key={day.id} aria-label={`${day.name} ${formatDate(day.date)}`}>
            <header><h3>{day.name}</h3><span>{day.date.getDate()}</span></header>
            <ul aria-label={`Tâches et rendez-vous du ${day.name}`}>
              {entries.length ? entries.map((entry) => entry.kind === "appointment" ? <li key={entry.key} className="am-planner-appointment">
                <div className="am-planner-appointment-row">
                  <span className="am-planner-appointment-marker" aria-hidden="true" />
                  <span className="am-planner-task-copy">
                    <span className="am-planner-task-main">
                      <time className="am-planner-task-time" dateTime={entry.booking.time}>{formatTime(entry.booking.time)}</time>
                      <span className="am-planner-task-title">Cours d’anglais</span>
                    </span>
                    <span className="am-planner-task-subtitle">{appointmentStatusLabel(entry.booking.status)} · lecture seule</span>
                  </span>
                </div>
              </li> : <li key={entry.key}>
                <div className="am-planner-task-row">
                  <label className={entry.occurrence.done ? "is-done" : ""}>
                    <input type="checkbox" checked={entry.occurrence.done} disabled={Boolean(pendingActionKey)} aria-label={`Marquer comme terminée : ${entry.occurrence.task.title}`} onChange={() => toggleOccurrence(entry.occurrence.task.id, entry.occurrence.date, entry.occurrence.done)} />
                    <span className="am-planner-task-copy">
                      <span className="am-planner-task-main">
                        {entry.occurrence.task.time && <time className="am-planner-task-time" dateTime={entry.occurrence.task.time}>{formatTime(entry.occurrence.task.time)}</time>}
                        <span className="am-planner-task-title">{entry.occurrence.task.title}</span>
                      </span>
                      {entry.occurrence.task.subtitle && <span className="am-planner-task-subtitle">{entry.occurrence.task.subtitle}</span>}
                      {entry.occurrence.task.recurring && <span className="am-planner-recurrence">Chaque semaine</span>}
                    </span>
                  </label>
                  <button type="button" aria-label={`Supprimer l’occurrence : ${entry.occurrence.task.title}`} disabled={Boolean(pendingActionKey)} onClick={() => deleteOccurrence(entry.occurrence.task.id, entry.occurrence.date)}><Trash2 size={15} /></button>
                </div>
              </li>) : <li className="am-planner-empty">Aucune tâche</li>}
            </ul>
            <div className="am-planner-writing" aria-hidden="true" />
          </section>;
        })}
      </div>
    </div>

    <dialog ref={dialogRef} hidden={!dialogVisible} className="am-planner-dialog" aria-labelledby="am-planner-dialog-title" onCancel={handleDialogCancel} onClose={handleDialogClose}>
      <form className="am-planner-dialog-form" onSubmit={addTask}>
        <div className="am-planner-dialog-heading">
          <div><p className="am-eyebrow">NOUVELLE TÂCHE</p><h2 id="am-planner-dialog-title">Ajouter une tâche</h2></div>
          <button type="button" className="am-planner-dialog-close" aria-label="Fermer la fenêtre" onClick={closeTaskDialog}><X size={20} /></button>
        </div>
        <div className="am-planner-dialog-fields">
          <label><span>Titre</span><input name="title" value={visibleDraft.title} onChange={(event) => updateDraft("title", event.target.value)} maxLength={180} autoComplete="off" required /></label>
          <label><span>Sous-titre <small>(facultatif)</small></span><input name="subtitle" value={visibleDraft.subtitle} onChange={(event) => updateDraft("subtitle", event.target.value)} maxLength={180} autoComplete="off" /></label>
          <div className="am-planner-dialog-row">
            <label><span>Définir le jour</span><input name="date" type="date" value={visibleDraft.date} onChange={(event) => updateDraft("date", event.target.value)} onInput={(event) => updateDraft("date", event.currentTarget.value)} onClick={(event) => event.currentTarget.showPicker?.()} required /></label>
            <label><span>Heure <small>(facultative)</small></span><input name="time" type="time" value={visibleDraft.time} onChange={(event) => updateDraft("time", event.target.value)} onInput={(event) => updateDraft("time", event.currentTarget.value)} /></label>
          </div>
        </div>

        <label className="am-planner-recurring-choice">
          <input type="checkbox" name="recurring" checked={visibleDraft.recurring} aria-label="Récurrence hebdomadaire" onChange={(event) => updateDraft("recurring", event.target.checked)} />
          <span><strong>Récurrence hebdomadaire</strong><small>Répéter chaque semaine à partir de la date choisie.</small></span>
        </label>
        <p className="am-planner-dialog-hint">Chaque occurrence reste indépendante : tu peux la cocher ou la supprimer sans modifier les autres semaines.</p>
        {dialogError ? <p className="am-planner-dialog-error" role="alert" aria-live="assertive">{dialogError}</p> : null}

        <div className="am-planner-dialog-actions">
          <button type="button" className="am-planner-cancel" onClick={closeTaskDialog}>Annuler</button>
          <button type="submit" className="am-button" disabled={Boolean(pendingActionKey)}><Plus size={17} />{pendingActionKey === "create" ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </form>
    </dialog>
  </div>;
}
