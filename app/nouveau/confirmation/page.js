import { Footer, Header } from "../_components/Shared";
import PaymentConfirmation from "./PaymentConfirmation";
import BookingConfirmation from "./BookingConfirmation";
import ClientRequestConfirmation from "./ClientRequestConfirmation";
import AccessBoundary from "../_components/AccessBoundary";
import { requireConnectedMemberPage } from "@/lib/server-auth";
import { createDevelopmentPreview } from "./confirmationLogic.mjs";

export const metadata = {
  title: "Confirmation du paiement — Animation Made",
  description: "Retrouve la confirmation et la prochaine étape de ton accompagnement.",
};

export default async function ConfirmationPage({ searchParams }) {
  const query = await searchParams;
  const bookingId = Array.isArray(query?.bookingId) ? query.bookingId[0] : query?.bookingId;
  const requestId = Array.isArray(query?.requestId) ? query.requestId[0] : query?.requestId;
  const cancelled = (Array.isArray(query?.etat) ? query.etat[0] : query?.etat) === "annule";
  const previewRecord = createDevelopmentPreview(query);
  const access = bookingId || requestId ? await requireConnectedMemberPage() : { ok: true };

  return (
    <>
      <Header />
      <main className="am-container am-confirmation-page">
        {bookingId
          ? access.ok
            ? <BookingConfirmation bookingId={bookingId} cancelled={cancelled} />
            : <AccessBoundary reason={access.reason} />
          : requestId
            ? access.ok
              ? <ClientRequestConfirmation requestId={requestId} cancelled={cancelled} />
              : <AccessBoundary reason={access.reason} />
          : <PaymentConfirmation paymentRecord={previewRecord} />}
      </main>
      <Footer />
    </>
  );
}
