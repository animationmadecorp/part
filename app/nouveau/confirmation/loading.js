import { Footer, Header } from "../_components/Shared";
import ConfirmationProgress from "./ConfirmationProgress";

export default function Loading() {
  return <>
    <Header />
    <main className="am-container am-confirmation-page">
      <ConfirmationProgress title="Nous préparons ta confirmation" message="Retour sécurisé en cours. Nous récupérons les informations de ta commande ; cette page va s’actualiser automatiquement." />
    </main>
    <Footer />
  </>;
}
