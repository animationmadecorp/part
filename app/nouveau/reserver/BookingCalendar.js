"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  Loader2,
  Mail,
  UserRound,
} from "lucide-react";
import {
  BOOKING_TIMEZONE,
  DEFAULT_BOOKING_CONFIG,
  getBookableSlots,
  getBookingWindow,
  parisDateKey,
  parisInstant,
} from "../_booking/bookingLogic.mjs";
import PrePaymentRecap from "../_components/PrePaymentRecap";
import { isNonBlank, paymentLabel } from "../_components/prePaymentLogic.mjs";
import "./booking.css";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LEVEL_OPTIONS = [
  "Débutant·e — je construis mes bases",
  "Intermédiaire — je comprends mais je manque d’aisance",
  "À l’aise — je veux gagner en précision et en naturel",
  "Je ne sais pas trop",
];
const EMPTY_FORM = { name: "", email: "", level: "", difficulties: "", goal: "" };

function draftStorageKey(mode, userId) {
  return `am-booking-intake:${userId || "signed-out"}:${mode}`;
}

function safeDraft(value) {
  if (!value || typeof value !== "object") return EMPTY_FORM;
  return Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, typeof value[key] === "string" ? value[key] : ""]));
}

function monthKeyFromDateKey(dateKey) {
  return dateKey.slice(0, 7);
}

function monthDate(monthKey) {
  return new Date(`${monthKey}-01T12:00:00.000Z`);
}

function addMonths(monthKey, amount) {
  const date = monthDate(monthKey);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: BOOKING_TIMEZONE,
  }).format(monthDate(monthKey));
}

function dateKeyFromUTCDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(dateKey) {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: BOOKING_TIMEZONE,
    }).format(parisInstant(dateKey, "12:00")),
  );
}

function formatTime(time) {
  const [hours, minutes] = time.split(":");
  return minutes === "00" ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`;
}

function snapshotFromAdapter(nextSnapshot) {
  const weeklyAvailability = Array.isArray(nextSnapshot?.weeklyAvailability)
    ? Object.fromEntries(
        nextSnapshot.weeklyAvailability.map((day) => [String(day.weekday), day.ranges]),
      )
    : nextSnapshot?.weeklyAvailability;
  const dateExceptions = Array.isArray(nextSnapshot?.dateExceptions)
    ? Object.fromEntries(
        nextSnapshot.dateExceptions.map((exception) => [exception.date, exception.ranges]),
      )
    : nextSnapshot?.dateExceptions;
  return {
    weeklyAvailability: weeklyAvailability ?? DEFAULT_BOOKING_CONFIG.weeklyAvailability,
    dateExceptions: dateExceptions ?? {},
    bookings: Array.isArray(nextSnapshot?.bookings) ? nextSnapshot.bookings : [],
    entitlements: Array.isArray(nextSnapshot?.entitlements) ? nextSnapshot.entitlements : [],
  };
}

function buildMonthDays(monthKey, now, offer, snapshot, config) {
  const first = monthDate(monthKey);
  // Monday-first grid: Sunday (0) becomes the seventh column.
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - mondayOffset);
  const todayKey = parisDateKey(now);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(date.getUTCDate() + index);
    const dateKey = dateKeyFromUTCDate(date);
    const slots = getBookableSlots({
      dateStr: dateKey,
      offer,
      dateExceptions: snapshot.dateExceptions,
      bookings: snapshot.bookings,
      now,
      config,
    });
    return {
      dateKey,
      dayNumber: date.getUTCDate(),
      inMonth: monthKeyFromDateKey(dateKey) === monthKey,
      isToday: dateKey === todayKey,
      slots,
      isBookable: slots.length > 0,
    };
  });
}

function BookingCalendarContent({ offer }) {
  const { user } = useUser();
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const remoteSnapshot = useQuery("bookings:getBookingAvailability", isAuthenticated ? {} : "skip");
  const createHold = useMutation("bookings:createHold");
  const cancelHold = useMutation("bookings:cancelHold");
  const confirmCreditBooking = useMutation("bookings:confirmCreditBooking");
  const holdRequestKey = useRef(null);
  const [now, setNow] = useState(null);
  const [monthCursor, setMonthCursor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [draftReadyKey, setDraftReadyKey] = useState(null);
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState(null);
  const [activeHold, setActiveHold] = useState(null);
  const formHeading = useRef(null);
  const draftKey = draftStorageKey(offer.mode, user?.id);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(draftKey) || "null");
      // Restoring browser-only state after hydration is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(safeDraft(saved));
    } catch {
      // Ignore malformed or unavailable local storage and keep a clean draft.
    }
    setDraftReadyKey(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (draftReadyKey !== draftKey) return;
    try { window.localStorage.setItem(draftKey, JSON.stringify(form)); }
    catch { /* The form remains usable when browser storage is unavailable. */ }
  }, [draftKey, draftReadyKey, form]);

  useEffect(() => {
    if (submitState === "idle" && selectedSlot) formHeading.current?.focus();
  }, [selectedSlot, submitState]);

  useEffect(() => {
    const current = new Date();
    const initialTimer = window.setTimeout(() => {
      setNow(current);
      setMonthCursor(monthKeyFromDateKey(parisDateKey(current)));
    }, 0);
    const refreshTimer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const snapshot = useMemo(
    () => (remoteSnapshot === undefined ? null : snapshotFromAdapter(remoteSnapshot)),
    [remoteSnapshot],
  );
  const loadState = convexAuthLoading
    ? "loading"
    : !isAuthenticated
      ? "error"
      : remoteSnapshot === undefined
        ? "loading"
        : "ready";
  const loadError = "La session Clerk/Convex n’est pas disponible.";

  const availabilityConfig = useMemo(
    () => ({
      ...DEFAULT_BOOKING_CONFIG,
      weeklyAvailability:
        snapshot?.weeklyAvailability ?? DEFAULT_BOOKING_CONFIG.weeklyAvailability,
    }),
    [snapshot?.weeklyAvailability],
  );
  const bookingWindow = useMemo(
    () => (now ? getBookingWindow(now, availabilityConfig) : null),
    [availabilityConfig, now],
  );
  const currentMonth = now ? monthKeyFromDateKey(parisDateKey(now)) : null;
  const maximumMonth = bookingWindow ? monthKeyFromDateKey(bookingWindow.maxDate) : null;
  const monthDays = useMemo(
    () =>
      monthCursor && now && snapshot
        ? buildMonthDays(monthCursor, now, offer, snapshot, availabilityConfig)
        : [],
    [availabilityConfig, monthCursor, now, offer, snapshot],
  );
  const selectedDay = monthDays.find((day) => day.dateKey === selectedDate);
  const selectedDaySlots = useMemo(
    () =>
      selectedDate && now && snapshot
        ? getBookableSlots({
            dateStr: selectedDate,
            offer,
            dateExceptions: snapshot.dateExceptions,
            bookings: snapshot.bookings,
            now,
            config: availabilityConfig,
          })
        : [],
    [availabilityConfig, now, offer, selectedDate, snapshot],
  );
  const availableCredit = useMemo(
    () => snapshot?.entitlements?.find(
      (entitlement) => entitlement.offerKey === offer.key &&
        entitlement.mode === offer.mode &&
        entitlement.remainingCredits > 0 &&
        entitlement.validUntil > (
          selectedDate && selectedSlot
            ? parisInstant(selectedDate, selectedSlot).getTime()
            : now?.getTime() || 0
        ),
    ) || null,
    [now, offer.key, offer.mode, selectedDate, selectedSlot, snapshot?.entitlements],
  );
  const isSubmitting = submitState === "processing";
  const isConfirmed = false;
  const ownsSelectedHold = Boolean(
    activeHold &&
      activeHold.date === selectedDate &&
      activeHold.time === selectedSlot &&
      activeHold.status === "pending" &&
      Number(activeHold.holdExpiresAt) > (now?.getTime() || 0),
  );
  useEffect(() => {
    if (!selectedSlot || isSubmitting || isConfirmed || selectedDaySlots.includes(selectedSlot) || ownsSelectedHold) return;
    const timer = window.setTimeout(() => {
      setSelectedSlot(null);
      setSubmitError("Ce créneau n’est plus disponible. Choisis-en un autre.");
      setSubmitState("idle");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isConfirmed, isSubmitting, ownsSelectedHold, selectedDaySlots, selectedSlot]);
  const previousDisabled = !currentMonth || !monthCursor || monthCursor <= currentMonth || isSubmitting || isConfirmed;
  const nextDisabled = !maximumMonth || !monthCursor || monthCursor >= maximumMonth || isSubmitting || isConfirmed;

  function selectDate(dateKey) {
    if (activeHold && activeHold.date !== dateKey) {
      void cancelHold({ bookingId: activeHold.id }).catch(() => {});
      setActiveHold(null);
    }
    setSelectedDate(dateKey);
    setSelectedSlot(null);
    setSubmitState("idle");
    setSubmitError(null);
    holdRequestKey.current = null;
  }

  function selectSlot(time) {
    if (activeHold && (activeHold.date !== selectedDate || activeHold.time !== time)) {
      void cancelHold({ bookingId: activeHold.id }).catch(() => {});
      setActiveHold(null);
    }
    setSelectedSlot(time);
    setSubmitState("idle");
    setSubmitError(null);
    holdRequestKey.current = null;
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  }

  function submit(event) {
    event.preventDefault();
    if (!selectedDate || !selectedSlot) return;
    const bookingForm = event.currentTarget;
    const name = bookingForm.elements.namedItem("name");
    name.setCustomValidity(isNonBlank(form.name) ? "" : "Renseigne ton nom.");
    const requiredText = [
      ["difficulties", form.difficulties, offer.mode === "duo" ? "Décrivez vos difficultés actuelles." : "Décris tes difficultés actuelles."],
      ["goal", form.goal, offer.mode === "duo" ? "Décrivez votre objectif d’apprentissage." : "Décris ton objectif d’apprentissage."],
    ];
    requiredText.forEach(([field, value, message]) => bookingForm.elements.namedItem(field).setCustomValidity(isNonBlank(value) ? "" : message));
    if (!bookingForm.checkValidity()) {
      setFormError(offer.mode === "duo" ? "Complétez les champs obligatoires avant de continuer." : "Complète les champs obligatoires avant de continuer.");
      const invalid = bookingForm.querySelector(":invalid");
      invalid?.focus();
      invalid?.reportValidity();
      return;
    }
    setFormError("");
    setSubmitError(null);
    setSubmitState("recap");
  }

  function friendlyPaymentError(value) {
    if (value === "stripe_configuration_required" || /Stripe test configuration is missing/i.test(value || "")) {
      return "Le paiement Stripe test n’est pas encore configuré dans cet environnement.";
    }
    if (value === "HOLD_EXPIRED" || /hold has expired/i.test(value || "")) {
      return "Le maintien temporaire a expiré. Choisis un nouveau créneau.";
    }
    if (/CREDITS_UNAVAILABLE|PAYMENT_REQUIRED/i.test(value || "")) {
      return "Ce crédit n’est plus disponible pour ce créneau. Choisis une autre date ou un autre mode.";
    }
    return "Le paiement n’a pas pu être préparé. Ton créneau n’a pas été confirmé.";
  }

  async function startPayment() {
    if (!selectedDate || !selectedSlot || isSubmitting) return;
    setSubmitState("processing");
    setSubmitError(null);
    const idempotencyKey = holdRequestKey.current || (globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    holdRequestKey.current = idempotencyKey;
    let booking = null;
    try {
      booking = await createHold({
        offerKey: offer.key,
        mode: offer.mode,
        date: selectedDate,
        time: selectedSlot,
        name: form.name,
        email: form.email,
        level: form.level,
        difficulties: form.difficulties,
        goal: form.goal,
        idempotencyKey,
        ...(availableCredit ? { entitlementId: availableCredit.id } : {}),
      });
      setActiveHold(booking);
      if (availableCredit) {
        const confirmed = await confirmCreditBooking({ bookingId: booking.id });
        try {
          await fetch("/api/booking/notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId: confirmed.notificationId, bookingId: confirmed.id, kind: "confirmed" }),
          });
        } catch {
          // The durable notification job remains available for a later retry.
        }
        window.location.assign(`/nouveau/confirmation?bookingId=${encodeURIComponent(confirmed.id)}`);
        return;
      }
      let response;
      try {
        response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking.id }),
        });
      } catch (networkError) {
        networkError.retryable = true;
        throw networkError;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        const checkoutError = new Error(payload.error || "stripe_unavailable");
        checkoutError.retryable = payload.retryable === true;
        throw checkoutError;
      }
      window.location.assign(payload.url);
    } catch (error) {
      if (booking?.id && !error?.retryable) {
        try { await cancelHold({ bookingId: booking.id }); } catch { /* expiry is safe */ }
        setActiveHold(null);
      }
      if (!error?.retryable) holdRequestKey.current = null;
      setSubmitState("recap");
      setSubmitError(friendlyPaymentError(error instanceof Error ? error.message : ""));
    }
  }

  function navigateMonth(amount) {
    setMonthCursor((current) => addMonths(current, amount));
    setSelectedDate(null);
    setSelectedSlot(null);
    setSubmitError(null);
    setSubmitState("idle");
  }

  if (loadState === "loading" || !now || !monthCursor) {
    return (
      <section className="am-booking-calendar" aria-label="Calendrier de réservation">
        <div className="am-calendar-state" role="status" aria-live="polite">
          <Loader2 size={22} className="am-spin" aria-hidden="true" />
          <span>Les disponibilités arrivent…</span>
        </div>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section className="am-booking-calendar" aria-labelledby="am-calendar-title">
        <div className="am-calendar-state am-calendar-error" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <div>
            <h2 id="am-calendar-title">Les disponibilités sont indisponibles</h2>
            <p>{loadError}</p>
            <button type="button" className="am-button" onClick={() => window.location.reload()}>
              Réessayer
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (submitState === "recap" || submitState === "processing") {
    const offerDetails = [
      "Rendez-vous en visioconférence sur Google Meet.",
      availableCredit
        ? "Un crédit de ton pack sera décompté. Aucun paiement supplémentaire ne sera demandé."
        : offer.sessionCount
        ? `${offer.sessionCount} cours individuels d’une heure à utiliser dans les ${offer.validityMonths} mois suivant l’achat.`
        : offer.mode === "duo"
          ? offer.payerNote
          : "Un cours individuel sur mesure d’une heure.",
      "Report possible jusqu’à 24 heures avant le cours. À moins de 24 heures ou en cas d’absence, la séance est décomptée, sauf exception accordée par Made.",
    ];
    return <section className="am-booking-calendar am-booking-payment-recap">
      <PrePaymentRecap
        offer={{
          name: offer.title,
          priceLabel: availableCredit ? "1 crédit" : offer.priceLabel,
          format: offer.modeLabel,
          details: offerDetails,
        }}
        paymentText={availableCredit ? "Utiliser 1 crédit" : paymentLabel(offer.priceLabel)}
        onEdit={() => setSubmitState("idle")}
        onPayment={startPayment}
        paymentDisabled={isSubmitting}
        paymentBusyLabel={availableCredit ? "Confirmation du cours…" : "Connexion à Stripe…"}
        paymentBusyMessage={availableCredit
          ? "Nous confirmons ton cours avec ton crédit. Ne relance pas l’opération."
          : "Connexion sécurisée à Stripe en cours. Ne relance pas le paiement."}
        paymentError={submitError}
        files={null}
        summaryTitle="Ton rendez-vous"
        items={[
          { label: "Créneau choisi", value: `${formatDate(selectedDate)} à ${formatTime(selectedSlot)} · Europe/Paris` },
          { label: "Format", value: `${offer.modeLabel} · ${offer.durationLabel}` },
          { label: "Visioconférence", value: "Google Meet" },
          { label: "Nom", value: form.name },
          { label: "E-mail", value: form.email },
          { label: offer.mode === "duo" ? "Votre niveau estimé" : "Ton niveau estimé", value: form.level },
          { label: offer.mode === "duo" ? "Vos difficultés actuelles" : "Tes difficultés actuelles", value: form.difficulties },
          { label: offer.mode === "duo" ? "Votre objectif régulier" : "Ton objectif régulier", value: form.goal },
        ]}
      />
    </section>;
  }

  return (
    <section className="am-booking-calendar" aria-labelledby="am-calendar-title">
      <div className="am-calendar-heading">
        <div>
          <p className="am-eyebrow">DISPONIBILITÉS</p>
          <h2 id="am-calendar-title">Choisis un jour</h2>
          <p>Les horaires sont affichés dans le fuseau Europe/Paris.</p>
        </div>
        <div className="am-calendar-meta" aria-label="Règles de réservation">
          <span><Clock3 size={17} aria-hidden="true" />{offer.durationLabel}</span>
          <span><Globe2 size={17} aria-hidden="true" />{BOOKING_TIMEZONE}</span>
        </div>
      </div>

      <div className="am-calendar-layout">
        <div className="am-calendar-card">
          <div className="am-calendar-toolbar">
            <h3>{capitalize(monthLabel(monthCursor))}</h3>
            <div className="am-calendar-nav" aria-label="Navigation mensuelle">
              <button
                type="button"
                aria-label="Mois précédent"
                disabled={previousDisabled}
                onClick={() => navigateMonth(-1)}
              >
                <ChevronLeft size={19} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Mois suivant"
                disabled={nextDisabled}
                onClick={() => navigateMonth(1)}
              >
                <ChevronRight size={19} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="am-calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="am-calendar-grid" aria-label={`Jours de ${monthLabel(monthCursor)}`}>
            {monthDays.map((day) => {
              const selected = day.dateKey === selectedDate;
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  className={`am-calendar-day${day.inMonth ? "" : " is-outside"}${day.isToday ? " is-today" : ""}${day.isBookable ? " is-available" : " is-closed"}${selected ? " is-selected" : ""}`}
                  disabled={!day.isBookable || isSubmitting || isConfirmed}
                  aria-pressed={selected}
                  aria-label={`${formatDate(day.dateKey)} — ${day.isBookable ? "disponible" : "indisponible"}`}
                  onClick={() => selectDate(day.dateKey)}
                >
                  <span>{day.dayNumber}</span>
                  {day.isBookable && <i aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="am-calendar-legend"><i aria-hidden="true" />Jour disponible</p>
        </div>

        <aside className="am-slots-card" aria-labelledby="am-slots-title" aria-live="polite">
          <div className="am-slots-heading">
            <div>
              <p className="am-eyebrow">CRÉNEAUX</p>
              <h3 id="am-slots-title">{selectedDate ? formatDate(selectedDate) : "Sélectionne un jour"}</h3>
            </div>
            <CalendarDays size={23} aria-hidden="true" />
          </div>
          {selectedDate ? (
            selectedDaySlots.length ? (
              <div className="am-slots-list" role="list" aria-label="Créneaux disponibles">
                {selectedDaySlots.map((time) => (
                  <button
                    key={time}
                    type="button"
                    className={`am-slot${selectedSlot === time ? " is-selected" : ""}`}
                    aria-pressed={selectedSlot === time}
                    disabled={isSubmitting || isConfirmed}
                    onClick={() => selectSlot(time)}
                  >
                    <span>{formatTime(time)}</span>
                    <small>{offer.durationLabel}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="am-slots-empty">Aucun créneau ne correspond à cette journée. Choisis un autre jour.</p>
            )
          ) : (
            <p className="am-slots-empty">Les jours avec un point coloré ont au moins un créneau disponible.</p>
          )}
          {selectedDay && !selectedDay.isBookable && selectedDate ? (
            <p className="am-slots-empty">Cette journée n’a plus de créneau disponible.</p>
          ) : null}
        </aside>
      </div>

      {submitError && !selectedSlot && !isConfirmed ? (
        <p className="am-form-error am-form-error-standalone" role="alert">
          <AlertCircle size={17} aria-hidden="true" />{submitError}
        </p>
      ) : null}

      {selectedSlot && !isConfirmed ? (
        <form className="am-booking-form" onSubmit={submit} aria-labelledby="am-form-title">
          <div className="am-booking-form-heading">
            <div>
              <p className="am-eyebrow">DERNIÈRE ÉTAPE</p>
              <h3 ref={formHeading} tabIndex={-1} id="am-form-title">Confirmer ton rendez-vous</h3>
              <p>{formatDate(selectedDate)} à {formatTime(selectedSlot)} · {offer.durationLabel}</p>
            </div>
            <span className="am-booking-form-icon" aria-hidden="true"><CheckCircle2 size={25} /></span>
          </div>

          <div className="am-booking-fields">
            <label htmlFor="booking-name"><span><UserRound size={15} aria-hidden="true" />Ton nom</span><input id="booking-name" name="name" type="text" autoComplete="name" value={form.name} onChange={(event) => { event.currentTarget.setCustomValidity(""); updateForm("name", event.target.value); }} required maxLength={120} placeholder="Ton prénom et ton nom" /></label>
            <label htmlFor="booking-email"><span><Mail size={15} aria-hidden="true" />Ton e-mail</span><input id="booking-email" name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} required placeholder="ton@email.fr" /></label>
            <fieldset className="am-booking-intake" aria-describedby={formError ? "booking-form-error" : undefined}>
              <legend>{offer.mode === "duo" ? "Préparez votre cours ensemble" : "Prépare ton cours"}</legend>
              <p>{offer.mode === "duo" ? "Répondez ensemble pour que le cours corresponde à vos besoins communs. Le nom et l’e-mail ci-dessus restent ceux de la personne qui réserve." : "Ces quelques repères permettent de préparer un cours adapté à ton quotidien."}</p>
              <label htmlFor="booking-level"><span>{offer.mode === "duo" ? "Votre niveau estimé" : "Ton niveau estimé"}</span><select id="booking-level" name="level" value={form.level} onChange={(event) => updateForm("level", event.target.value)} required><option value="">Choisir une option</option>{LEVEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
              <label htmlFor="booking-difficulties"><span>{offer.mode === "duo" ? "Vos difficultés actuelles" : "Tes difficultés actuelles"}</span><textarea id="booking-difficulties" name="difficulties" value={form.difficulties} onChange={(event) => { event.currentTarget.setCustomValidity(""); updateForm("difficulties", event.target.value); }} required maxLength={1200} rows={4} placeholder={offer.mode === "duo" ? "Ce qui vous freine aujourd’hui : compréhension, prise de parole, vocabulaire…" : "Ce qui te freine aujourd’hui : compréhension, prise de parole, vocabulaire…"}/></label>
              <label htmlFor="booking-goal"><span>{offer.mode === "duo" ? "Votre objectif d’apprentissage régulier" : "Ton objectif d’apprentissage régulier"}</span><textarea id="booking-goal" name="goal" value={form.goal} onChange={(event) => { event.currentTarget.setCustomValidity(""); updateForm("goal", event.target.value); }} required maxLength={1200} rows={4} placeholder={offer.mode === "duo" ? "Ce que vous voulez réussir à pratiquer régulièrement après le cours" : "Ce que tu veux réussir à pratiquer régulièrement après le cours"}/></label>
            </fieldset>
          </div>
          {formError ? <p id="booking-form-error" className="am-form-error" role="alert" aria-live="assertive"><AlertCircle size={17} aria-hidden="true" />{formError}</p> : null}
          {submitError ? <p className="am-form-error" role="alert"><AlertCircle size={17} aria-hidden="true" />{submitError}</p> : null}
          <div className="am-booking-form-actions">
            <button type="button" className="am-button am-outline" disabled={isSubmitting} onClick={() => setSelectedSlot(null)}>Changer de créneau</button>
            <button type="submit" className="am-button">Continuer vers le paiement</button>
          </div>
        </form>
      ) : null}

    </section>
  );
}

class BookingCalendarBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="am-booking-calendar" aria-labelledby="am-calendar-error-title">
      <div className="am-calendar-state am-calendar-error" role="alert">
        <AlertCircle size={22} aria-hidden="true" />
        <div>
          <h2 id="am-calendar-error-title">Les disponibilités sont indisponibles</h2>
          <p>La connexion sécurisée n’a pas pu charger les disponibilités. Réessaie.</p>
          <button type="button" className="am-button" onClick={() => window.location.reload()}>Réessayer</button>
        </div>
      </div>
    </section>;
  }
}

export default function BookingCalendar(props) {
  return <BookingCalendarBoundary><BookingCalendarContent {...props} /></BookingCalendarBoundary>;
}
