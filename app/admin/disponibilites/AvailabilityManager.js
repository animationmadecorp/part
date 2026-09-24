"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  BOOKING_TIMEZONE,
  isValidDateKey,
  weekdayISO,
} from "../../nouveau/_booking/bookingLogic.mjs";
import {
  cloneAvailability,
} from "../../nouveau/_booking/localAvailabilityAdapter.mjs";
import AvailabilityEditor from "../../../components/booking/AvailabilityEditor";
import { copyRanges } from "../../../components/booking/availabilityRanges.mjs";
import "./availability.css";

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

  return (
    <AvailabilityEditor
      availability={availability}
      timezone={BOOKING_TIMEZONE}
      exceptionDate={exceptionDate}
      setExceptionDate={setExceptionDate}
      notice={notice}
      status={status}
      hasChanges={hasChanges}
      save={save}
      addException={addException}
      removeException={removeException}
      changeWeeklyDay={changeWeeklyDay}
      changeException={changeException}
    />
  );
}
