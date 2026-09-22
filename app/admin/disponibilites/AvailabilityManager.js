"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  BOOKING_TIMEZONE,
  isValidDateKey,
  weekdayISO,
} from "../../nouveau/_booking/bookingLogic.mjs";
import {
  cloneAvailability,
} from "../../nouveau/_booking/localAvailabilityAdapter.mjs";
import "./availability.css";

const WEEKDAYS = [
  { key: 1, label: "Lundi" },
  { key: 2, label: "Mardi" },
  { key: 3, label: "Mercredi" },
  { key: 4, label: "Jeudi" },
  { key: 5, label: "Vendredi" },
  { key: 6, label: "Samedi" },
  { key: 7, label: "Dimanche" },
];

const DEFAULT_RANGE = { start: "09:00", end: "12:00" };

function copyRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : []).map((range) => ({
    start: range.start,
    end: range.end,
  }));
}

function updateRange(ranges, index, field, value) {
  const nextRanges = copyRanges(ranges);
  nextRanges[index] = { ...nextRanges[index], [field]: value };
  return nextRanges;
}

function dateLabel(dateKey) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function RangeFields({ idPrefix, index, range, onChange, onRemove, removeLabel, context }) {
  return (
    <div className="am-availability-range-row">
      <label htmlFor={`${idPrefix}-start-${index}`}>
        Début
        <input
          id={`${idPrefix}-start-${index}`}
          className="input"
          type="time"
          value={range.start}
          aria-label={`Début de ${context}`}
          onChange={(event) => onChange("start", event.target.value)}
          step="300"
        />
      </label>
      <label htmlFor={`${idPrefix}-end-${index}`}>
        Fin
        <input
          id={`${idPrefix}-end-${index}`}
          className="input"
          type="time"
          value={range.end}
          aria-label={`Fin de ${context}`}
          onChange={(event) => onChange("end", event.target.value)}
          step="300"
        />
      </label>
      <button
        type="button"
        className="am-availability-icon-button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
      >
        <Trash2 size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function AvailabilityDay({ day, ranges, onChange, idPrefix, exception = false, ariaLabelledBy }) {
  const isOpen = ranges.length > 0;
  const openLabel = exception
    ? isOpen
        ? "Fermer cette date"
        : "Ouvrir cette date"
    : isOpen
      ? "Fermer le jour"
      : "Ouvrir le jour";

  function toggleOpen() {
    onChange(isOpen ? [] : [DEFAULT_RANGE]);
  }

  return (
    <fieldset className="am-availability-day" aria-labelledby={ariaLabelledBy}>
      <legend className="am-availability-day-legend">
        <span>{day}</span>
        <span className={isOpen ? "am-availability-open" : "am-availability-closed"}>
          {isOpen ? "Ouvert" : "Fermé"}
        </span>
      </legend>
      <div className="am-availability-day-actions">
        <span className="am-availability-day-hint">
          {isOpen ? "Plages disponibles" : "Aucun créneau ce jour"}
        </span>
        <button
          type="button"
          className="pill btn-ghost text-sm"
          aria-pressed={isOpen}
          aria-label={`${openLabel} : ${day}`}
          onClick={toggleOpen}
        >
          {openLabel}
        </button>
      </div>

      {isOpen ? (
        <div className="am-availability-ranges">
          {ranges.map((range, index) => (
            <RangeFields
              key={`${idPrefix}-${index}`}
              idPrefix={`${idPrefix}-range`}
              index={index}
              range={range}
              onChange={(field, value) => onChange(updateRange(ranges, index, field, value))}
              onRemove={() => onChange(ranges.filter((_, rangeIndex) => rangeIndex !== index))}
              removeLabel={`Supprimer la plage ${index + 1} de ${day}`}
              context={`${day}, plage ${index + 1}`}
            />
          ))}
          <button
            type="button"
            className="am-availability-add-range"
            onClick={() => onChange([...copyRanges(ranges), { ...DEFAULT_RANGE }])}
          >
            <Plus size={16} aria-hidden="true" />
            Ajouter une plage
          </button>
        </div>
      ) : (
        <p className="am-availability-closed-note">La journée est complètement fermée.</p>
      )}
    </fieldset>
  );
}

export default function AvailabilityManager() {
  const remoteAvailability = useQuery("bookings:getAdminAvailability", {});
  const saveRemoteAvailability = useMutation("bookings:saveAdminAvailability");
  const [availability, setAvailability] = useState(null);
  const [savedAvailability, setSavedAvailability] = useState(null);
  const [exceptionDate, setExceptionDate] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (remoteAvailability === undefined) return;
    const weeklyAvailability = Object.fromEntries(
      (Array.isArray(remoteAvailability.weeklyAvailability)
        ? remoteAvailability.weeklyAvailability
        : []
      ).map((day) => [String(day.weekday), day.ranges]),
    );
    const dateExceptions = Object.fromEntries(
      (Array.isArray(remoteAvailability.dateExceptions)
        ? remoteAvailability.dateExceptions
        : []
      ).map((exception) => [exception.date, exception.ranges]),
    );
    const snapshot = cloneAvailability({ weeklyAvailability, dateExceptions });
    // The query is the source of truth; copy it into editable local state only
    // after Convex has returned a complete snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailability(snapshot);
    setSavedAvailability(snapshot);
    setLoadError("");
    setStatus("ready");
  }, [remoteAvailability]);

  const hasChanges = useMemo(
    () =>
      Boolean(availability && savedAvailability) &&
      JSON.stringify(availability) !== JSON.stringify(savedAvailability),
    [availability, savedAvailability],
  );

  function markChanged(updater) {
    setAvailability((current) => (current ? updater(current) : current));
    setStatus("ready");
    setNotice("");
  }

  function changeWeeklyDay(weekday, ranges) {
    markChanged((current) => ({
      ...current,
      weeklyAvailability: {
        ...current.weeklyAvailability,
        [String(weekday)]: copyRanges(ranges),
      },
    }));
  }

  function changeException(dateKey, ranges) {
    markChanged((current) => ({
      ...current,
      dateExceptions: {
        ...current.dateExceptions,
        [dateKey]: copyRanges(ranges),
      },
    }));
  }

  function addException(event) {
    event.preventDefault();
    setNotice("");
    if (!isValidDateKey(exceptionDate)) {
      setNotice("Choisis une date valide.");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(availability.dateExceptions, exceptionDate)) {
      setNotice("Cette date est déjà une exception.");
      return;
    }

    const weekday = weekdayISO(exceptionDate);
    markChanged((current) => ({
      ...current,
      dateExceptions: {
        ...current.dateExceptions,
        [exceptionDate]: copyRanges(current.weeklyAvailability[String(weekday)]),
      },
    }));
    setExceptionDate("");
  }

  function removeException(dateKey) {
    markChanged((current) => {
      const dateExceptions = { ...current.dateExceptions };
      delete dateExceptions[dateKey];
      return { ...current, dateExceptions };
    });
  }

  async function save() {
    if (!availability || !hasChanges || status === "saving") return;
    setStatus("saving");
    setNotice("");
    try {
      const saved = await saveRemoteAvailability({
        weeklyAvailability: Object.entries(availability.weeklyAvailability).map(([weekday, ranges]) => ({
          weekday: Number(weekday),
          ranges,
        })),
        dateExceptions: Object.entries(availability.dateExceptions).map(([date, ranges]) => ({
          date,
          ranges,
        })),
      });
      const normalized = cloneAvailability({
        weeklyAvailability: Object.fromEntries(saved.weeklyAvailability.map((day) => [String(day.weekday), day.ranges])),
        dateExceptions: Object.fromEntries(saved.dateExceptions.map((exception) => [exception.date, exception.ranges])),
      });
      setAvailability(normalized);
      setSavedAvailability(normalized);
      setStatus("saved");
      setNotice("Les disponibilités sont enregistrées dans Convex.");
    } catch (error) {
      setStatus("ready");
      setNotice(error instanceof Error ? error.message : "Vérifie les horaires saisis.");
    }
  }

  if (status === "loading") {
    return (
      <div className="am-availability-state" role="status" aria-live="polite">
        <Loader2 size={20} className="am-availability-spin" aria-hidden="true" />
        Chargement des disponibilités…
      </div>
    );
  }

  if (status === "error" || !availability) {
    return (
      <div className="am-availability-state am-availability-error" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        <div>
          <p>{loadError || "Les disponibilités ne sont pas accessibles."}</p>
          <button type="button" className="pill btn-ghost text-sm" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const exceptionDates = Object.keys(availability.dateExceptions).sort();

  return (
    <div className="am-availability">
      <div className="am-availability-savebar">
        <div>
          <p className="am-availability-savebar-title">Fuseau {BOOKING_TIMEZONE}</p>
          <p className="am-availability-savebar-note">
            Les horaires enregistrés alimentent le calendrier de réservation.
          </p>
        </div>
        <button
          type="button"
          className="pill btn-primary am-availability-save"
          onClick={save}
          disabled={!hasChanges || status === "saving"}
        >
          {status === "saving" ? <Loader2 size={16} className="am-availability-spin" aria-hidden="true" /> : null}
          {status === "saving" ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      <p className={`am-availability-notice${notice && status !== "saved" ? " is-error" : ""}`} role={notice && status !== "saved" ? "alert" : "status"} aria-live="polite">
        {notice || (hasChanges ? "Des modifications ne sont pas encore enregistrées." : "")}
      </p>

      <section className="am-availability-section" aria-labelledby="am-weekly-title">
        <div className="am-availability-section-heading">
          <div>
            <p className="eyebrow">HORAIRES HABITUELS</p>
            <h2 id="am-weekly-title" className="font-display text-2xl">Chaque semaine</h2>
          </div>
          <p>Ferme un jour ou ajoute plusieurs plages dans la même journée.</p>
        </div>
        <div className="am-availability-days">
          {WEEKDAYS.map((day) => (
            <AvailabilityDay
              key={day.key}
              day={day.label}
              ranges={availability.weeklyAvailability[String(day.key)] || []}
              idPrefix={`weekly-${day.key}`}
              onChange={(ranges) => changeWeeklyDay(day.key, ranges)}
            />
          ))}
        </div>
      </section>

      <section className="am-availability-section" aria-labelledby="am-exceptions-title">
        <div className="am-availability-section-heading">
          <div>
            <p className="eyebrow">DATES PARTICULIÈRES</p>
            <h2 id="am-exceptions-title" className="font-display text-2xl">Exceptions</h2>
          </div>
          <p>Une exception remplace les horaires habituels pour une date précise.</p>
        </div>

        <form className="am-availability-exception-form" onSubmit={addException}>
          <label htmlFor="availability-exception-date">
            Date à modifier
            <input
              id="availability-exception-date"
              className="input"
              type="date"
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="pill btn-ghost am-availability-add-exception">
            <Plus size={17} aria-hidden="true" />
            Ajouter une exception
          </button>
        </form>

        {exceptionDates.length === 0 ? (
          <p className="text-muted text-sm">Aucune exception enregistrée.</p>
        ) : (
          <div className="am-availability-exceptions">
            {exceptionDates.map((dateKey) => (
              <div key={dateKey} className="am-availability-exception">
                <div
                  id={`exception-${dateKey}-heading`}
                  className="am-availability-exception-heading"
                >
                  <div>
                    <p className="am-availability-exception-date">
                      <time dateTime={dateKey}>{dateLabel(dateKey)}</time>
                    </p>
                    <p className="am-availability-day-hint">Horaires de cette date</p>
                  </div>
                  <button
                    type="button"
                    className="am-availability-revert"
                    onClick={() => removeException(dateKey)}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Revenir aux horaires habituels
                  </button>
                </div>
                <AvailabilityDay
                  day={dateLabel(dateKey)}
                  ranges={availability.dateExceptions[dateKey] || []}
                  idPrefix={`exception-${dateKey}`}
                  exception
                  ariaLabelledBy={`exception-${dateKey}-heading`}
                  onChange={(ranges) => changeException(dateKey, ranges)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
