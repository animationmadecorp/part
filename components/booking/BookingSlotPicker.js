"use client";

import { useId } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Globe2 } from "lucide-react";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** A provider-agnostic date and slot picker. The caller owns availability rules and selection. */
export default function BookingSlotPicker({
  titleId,
  monthDays,
  monthLabel,
  formatDate,
  formatTime,
  timezone,
  durationLabel,
  selectedDate,
  selectedDay,
  selectedDaySlots,
  selectedSlot,
  previousDisabled,
  nextDisabled,
  isSubmitting,
  isConfirmed,
  navigateMonth,
  selectDate,
  selectSlot,
}) {
  const generatedTitleId = useId();
  const slotsTitleId = useId();
  const resolvedTitleId = titleId || generatedTitleId;

  return (
    <>
      <div className="am-calendar-heading">
        <div>
          <p className="am-eyebrow">DISPONIBILITÉS</p>
          <h2 id={resolvedTitleId}>Choisis un jour</h2>
          <p>Les horaires sont affichés dans le fuseau {timezone}.</p>
        </div>
        <div className="am-calendar-meta" aria-label="Règles de réservation">
          <span><Clock3 size={17} aria-hidden="true" />{durationLabel}</span>
          <span><Globe2 size={17} aria-hidden="true" />{timezone}</span>
        </div>
      </div>
      <div className="am-calendar-layout">
        <div className="am-calendar-card">
          <div className="am-calendar-toolbar">
            <h3>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3>
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
          <div className="am-calendar-grid" aria-label={`Jours de ${monthLabel}`}>
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

        <aside className="am-slots-card" aria-labelledby={slotsTitleId} aria-live="polite">
          <div className="am-slots-heading">
            <div>
              <p className="am-eyebrow">CRÉNEAUX</p>
              <h3 id={slotsTitleId}>{selectedDate ? formatDate(selectedDate) : "Sélectionne un jour"}</h3>
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
                    <small>{durationLabel}</small>
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

    </>
  );
}
