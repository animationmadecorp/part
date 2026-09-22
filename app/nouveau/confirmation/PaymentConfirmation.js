import Link from "next/link";
import { Ban, CalendarDays, Check, CircleAlert, Clock3, Video } from "lucide-react";
import { createConfirmationView } from "./confirmationLogic.mjs";

const TRACKING_HREF = "/nouveau/bibliotheque?onglet=suivi";

function PendingConfirmation({ preview = false }) {
  return (
    <section className="am-confirmation-card am-confirmation-pending" aria-labelledby="confirmation-title">
      {preview && <p className="am-confirmation-preview" role="status">Aperçu de développement — aucune commande ni aucun paiement réel.</p>}
      <p className="am-eyebrow">PAIEMENT</p>
      <h1 id="confirmation-title">Vérification du paiement</h1>
      <p className="am-confirmation-lead">
        Nous vérifions le statut de ton paiement. Ton suivi sera accessible dès que sa confirmation aura été reçue.
      </p>
      <Link className="am-button" href={TRACKING_HREF}>Accéder à mon suivi</Link>
    </section>
  );
}

const RECOVERY_COPY = Object.freeze({
  cancelled: {
    eyebrow: "PAIEMENT NON FINALISÉ",
    title: "Le paiement n’a pas été finalisé",
    body: "Tu peux reprendre quand tu le souhaites. Aucun achat n’est considéré comme confirmé sur cette page.",
    retryLabel: "Reprendre ma demande",
    Icon: Ban,
  },
  failed: {
    eyebrow: "PAIEMENT ÉCHOUÉ",
    title: "Le paiement n’a pas abouti",
    body: "Tu peux réessayer sans recommencer ton questionnaire. Tes réponses et tes choix restent conservés par ce navigateur lorsqu’ils y ont été enregistrés.",
    retryLabel: "Réessayer le paiement",
    Icon: CircleAlert,
  },
});

function PaymentRecovery({ view }) {
  const copy = RECOVERY_COPY[view.status];
  const Icon = copy.Icon;
  return (
    <section className={`am-confirmation-card am-confirmation-${view.status}`} aria-labelledby="confirmation-title">
      <div className="am-confirmation-status am-confirmation-status-neutral" aria-hidden="true"><Icon size={24} /></div>
      {view.preview && <p className="am-confirmation-preview" role="status">Aperçu de développement — aucune commande ni aucun paiement réel.</p>}
      <p className="am-eyebrow">{copy.eyebrow}</p>
      <h1 id="confirmation-title">{copy.title}</h1>
      <p className="am-confirmation-lead">{copy.body}</p>
      {view.offer && (
        <div className="am-confirmation-summary am-confirmation-summary-single" aria-label="Offre concernée">
          <div><span>Offre</span><strong>{view.offer.name}</strong></div>
        </div>
      )}
      <div className="am-confirmation-actions">
        <Link className="am-button" href={view.recovery.retryHref}>{copy.retryLabel}</Link>
        <Link className="am-secondary-button" href={view.recovery.offerHref}>Revoir l’offre</Link>
        <Link className="am-confirmation-programs" href="/nouveau#programmes">Voir tous les programmes</Link>
      </div>
    </section>
  );
}

function Appointment({ appointment }) {
  if (!appointment) return null;
  return (
    <div className="am-confirmation-appointment" aria-label="Ton rendez-vous">
      <h2>Ton rendez-vous</h2>
      <dl>
        {appointment.dateLabel && <div><dt><CalendarDays size={18} aria-hidden="true" />Date</dt><dd>{appointment.dateLabel}</dd></div>}
        {appointment.timeLabel && <div><dt><Clock3 size={18} aria-hidden="true" />Horaire</dt><dd>{appointment.timeLabel}</dd></div>}
        <div><dt><Video size={18} aria-hidden="true" />Format</dt><dd>{appointment.formatLabel} · Google Meet</dd></div>
      </dl>
      {appointment.meetUrl && <a className="am-secondary-button" href={appointment.meetUrl} target="_blank" rel="noreferrer">Rejoindre Google Meet</a>}
    </div>
  );
}

export default function PaymentConfirmation({ paymentRecord = null }) {
  const view = createConfirmationView(paymentRecord);
  if (view.status === "failed" || view.status === "cancelled") {
    return <PaymentRecovery view={view} />;
  }
  if (!view.confirmed) return <PendingConfirmation preview={view.preview} />;

  return (
    <section className="am-confirmation-card" aria-labelledby="confirmation-title">
      {view.preview && <p className="am-confirmation-preview" role="status">Aperçu de développement — aucune commande ni aucun paiement réel.</p>}
      <div className="am-confirmation-status" aria-hidden="true"><Check size={24} /></div>
      <p className="am-eyebrow">PAIEMENT CONFIRMÉ</p>
      <h1 id="confirmation-title">Ton paiement est confirmé</h1>
      <div className="am-confirmation-summary" aria-label="Récapitulatif du paiement">
        <div><span>Offre</span><strong>{view.offer.name}</strong></div>
        <div><span>Total payé</span><strong>{view.offer.priceLabel}</strong></div>
      </div>

      {view.filesComplete ? (
        <div className="am-confirmation-next">
          <p className="am-eyebrow">PROCHAINE ÉTAPE</p>
          <h2>{view.offer.nextTitle}</h2>
          <p>{view.offer.nextBody}</p>
        </div>
      ) : (
        <div className="am-confirmation-next am-confirmation-files" role="status">
          <p className="am-eyebrow">ÉLÉMENTS À COMPLÉTER</p>
          <h2>Termine l’envoi de tes fichiers</h2>
          <p>Ton paiement est bien confirmé, mais il manque encore des éléments. Ajoute-les dans ton suivi pour que ton dossier puisse être pris en charge. Le délai de livraison commencera une fois tous les éléments nécessaires reçus.</p>
        </div>
      )}

      <Appointment appointment={view.appointment} />
      <Link className="am-button am-confirmation-cta" href={TRACKING_HREF}>Accéder à mon suivi</Link>
    </section>
  );
}
