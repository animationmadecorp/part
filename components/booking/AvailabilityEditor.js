"use client";

import { useId } from "react";
import { AlertCircle, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { copyRanges } from "./availabilityRanges.mjs";

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

/** Editable availability UI. Persistence and authorization belong to the caller. */
export default function AvailabilityEditor({
  availability,
  timezone,
  exceptionDate,
  setExceptionDate,
  notice,
  status,
  hasChanges,
  save,
  addException,
  removeException,
  changeWeeklyDay,
  changeException,
}) {
  const idPrefix = useId();
  const weeklyTitleId = `${idPrefix}-weekly-title`;
  const exceptionsTitleId = `${idPrefix}-exceptions-title`;
  const exceptionDateId = `${idPrefix}-exception-date`;
  const exceptionDates = Object.keys(availability.dateExceptions).sort();

  return (
    <div className="am-availability">
      <div className="am-availability-savebar">
        <div>
          <p className="am-availability-savebar-title">Fuseau {timezone}</p>
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

      <section className="am-availability-section" aria-labelledby={weeklyTitleId}>
        <div className="am-availability-section-heading">
          <div>
            <p className="eyebrow">HORAIRES HABITUELS</p>
            <h2 id={weeklyTitleId} className="font-display text-2xl">Chaque semaine</h2>
          </div>
          <p>Ferme un jour ou ajoute plusieurs plages dans la même journée.</p>
        </div>
        <div className="am-availability-days">
          {WEEKDAYS.map((day) => (
            <AvailabilityDay
              key={day.key}
              day={day.label}
              ranges={availability.weeklyAvailability[String(day.key)] || []}
              idPrefix={`${idPrefix}-weekly-${day.key}`}
              onChange={(ranges) => changeWeeklyDay(day.key, ranges)}
            />
          ))}
        </div>
      </section>

      <section className="am-availability-section" aria-labelledby={exceptionsTitleId}>
        <div className="am-availability-section-heading">
          <div>
            <p className="eyebrow">DATES PARTICULIÈRES</p>
            <h2 id={exceptionsTitleId} className="font-display text-2xl">Exceptions</h2>
          </div>
          <p>Une exception remplace les horaires habituels pour une date précise.</p>
        </div>

        <form className="am-availability-exception-form" onSubmit={addException}>
          <label htmlFor={exceptionDateId}>
            Date à modifier
            <input
              id={exceptionDateId}
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
                  id={`${idPrefix}-exception-${dateKey}-heading`}
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
                  idPrefix={`${idPrefix}-exception-${dateKey}`}
                  exception
                  ariaLabelledBy={`${idPrefix}-exception-${dateKey}-heading`}
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
