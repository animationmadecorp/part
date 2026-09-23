import { Loader2 } from "lucide-react";

export default function ConfirmationProgress({
  eyebrow = "CONFIRMATION EN COURS",
  title = "Nous vérifions ton paiement",
  message = "La confirmation sécurisée peut prendre quelques instants. Cette page se met à jour automatiquement : inutile de relancer le paiement.",
}) {
  return <section className="am-confirmation-card am-confirmation-progress" role="status" aria-live="polite">
    <div className="am-confirmation-progress-icon" aria-hidden="true"><Loader2 size={28} /></div>
    <p className="am-eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p className="am-confirmation-lead">{message}</p>
    <div className="am-confirmation-progress-track" aria-hidden="true"><span /></div>
  </section>;
}
