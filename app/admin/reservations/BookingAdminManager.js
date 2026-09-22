"use client";

import { useState } from "react";
import { CalendarDays, Loader2, Save, Video } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function BookingAdminManager() {
  const bookings = useQuery("bookings:getAdminBookings", {});
  const setMeetLink = useMutation("bookings:setMeetLink");
  const adminReschedule = useMutation("bookings:adminRescheduleBooking");
  const [meetValues, setMeetValues] = useState({});
  const [rescheduleValues, setRescheduleValues] = useState({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  if (bookings === undefined) return <p role="status">Chargement des réservations…</p>;

  async function saveMeet(booking) {
    const meetUrl = (meetValues[booking.id] ?? booking.meetUrl ?? "").trim();
    setBusy(`meet:${booking.id}`);
    setNotice("");
    try {
      await setMeetLink({ bookingId: booking.id, meetUrl });
      setNotice("Lien Google Meet enregistré côté serveur.");
    } catch {
      setNotice("Le lien doit être une URL Google Meet valide.");
    } finally {
      setBusy("");
    }
  }

  async function saveReschedule(booking) {
    const next = rescheduleValues[booking.id];
    if (!next?.date || !next?.time) return;
    const idempotencyKey = next.idempotencyKey || crypto.randomUUID();
    if (!next.idempotencyKey) {
      setRescheduleValues({ ...rescheduleValues, [booking.id]: { ...next, idempotencyKey } });
    }
    setBusy(`move:${booking.id}`);
    setNotice("");
    try {
      const updated = await adminReschedule({ bookingId: booking.id, date: next.date, time: next.time, reason: "Exception administrateur", idempotencyKey });
      try {
        await fetch("/api/booking/notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: updated.notificationId, bookingId: updated.id, kind: "rescheduled" }),
        });
      } catch {
        // The durable notification job remains available for a later retry.
      }
      setRescheduleValues((current) => {
        const nextValues = { ...current };
        delete nextValues[booking.id];
        return nextValues;
      });
      setNotice("Report administrateur enregistré. Aucun crédit supplémentaire n’a été décompté.");
    } catch {
      setNotice("Le nouveau créneau n’est pas disponible.");
    } finally {
      setBusy("");
    }
  }

  return <section aria-live="polite">
    {notice ? <p role="status" className="am-availability-notice">{notice}</p> : null}
    {!bookings.length ? <p>Aucune réservation enregistrée.</p> : <div className="am-admin-bookings">
      {bookings.map((booking) => {
        const move = rescheduleValues[booking.id] || { date: booking.date, time: booking.time };
        return <article key={booking.id} className="am-admin-booking-card">
          <header><div><p className="eyebrow">{booking.status} · {booking.paymentStatus}</p><h2>{formatDate(booking.date)} · {booking.time}</h2><p>{booking.name} · {booking.email}</p></div><span><CalendarDays size={20} />{booking.mode}</span></header>
          <dl><div><dt>Niveau</dt><dd>{booking.level}</dd></div><div><dt>Difficultés</dt><dd>{booking.difficulties}</dd></div><div><dt>Objectif</dt><dd>{booking.goal}</dd></div></dl>
          <div className="am-admin-booking-actions">
            <label><span><Video size={15} />Lien Google Meet</span><input type="url" value={meetValues[booking.id] ?? booking.meetUrl ?? ""} placeholder="https://meet.google.com/xxx-yyyy-zzz" onChange={(event) => setMeetValues({ ...meetValues, [booking.id]: event.target.value })} /></label>
            <button type="button" className="pill btn-primary" disabled={busy === `meet:${booking.id}`} onClick={() => saveMeet(booking)}>{busy === `meet:${booking.id}` ? <Loader2 className="am-availability-spin" size={15} /> : <Save size={15} />} Enregistrer le lien</button>
            {booking.status === "confirmed" ? <><label><span>Exception : nouvelle date</span><input type="date" value={move.date} onChange={(event) => setRescheduleValues({ ...rescheduleValues, [booking.id]: { ...move, date: event.target.value, idempotencyKey: crypto.randomUUID() } })} /></label><label><span>Nouvel horaire</span><input type="time" value={move.time} onChange={(event) => setRescheduleValues({ ...rescheduleValues, [booking.id]: { ...move, time: event.target.value, idempotencyKey: crypto.randomUUID() } })} /></label><button type="button" className="pill btn-ghost" disabled={busy === `move:${booking.id}`} onClick={() => saveReschedule(booking)}>Reporter comme exception</button></> : null}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
