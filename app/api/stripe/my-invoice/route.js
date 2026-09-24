import { anyApi } from "convex/server";
import { getAuthenticatedConvexClient, getClerkSession } from "@/lib/server-auth";
import { getStripeCheckoutSession, getStripeCreditNotes, getStripeInvoice, getStripeConfig } from "@/lib/stripe-server.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request) {
  const session = await getClerkSession();
  if (!session.authenticated) return json({ error: "authentication_required" }, 401);
  const convex = await getAuthenticatedConvexClient(session);
  if (!convex.ok) return json({ error: "account_unavailable" }, 503);

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const id = params.get("id");
  if (!id || id.length > 100 || !["request", "entitlement"].includes(kind)) return json({ error: "invalid_purchase" }, 400);

  let purchase;
  try {
    purchase = await convex.client.query(anyApi.account.getMyInvoiceCheckout, {
      sessionUserId: session.userId,
      ...(kind === "request" ? { requestId: id } : { entitlementId: id }),
    });
  } catch {
    // Invalid IDs and orders owned by somebody else are indistinguishable.
    return json({ error: "purchase_not_found" }, 404);
  }
  if (!purchase?.checkoutSessionId) return json({ status: "unavailable" }, 200);

  const stripeConfig = getStripeConfig();
  if (!stripeConfig.checkoutEnabled) return json({ error: "invoice_unavailable" }, 503);
  try {
    const checkout = await getStripeCheckoutSession(purchase.checkoutSessionId);
    if (checkout.id !== purchase.checkoutSessionId || checkout.livemode !== stripeConfig.liveMode ||
      checkout.metadata?.userId !== session.userId || checkout.payment_status !== "paid") {
      return json({ error: "invoice_unavailable" }, 503);
    }
    if (!checkout.invoice) {
      return json({ status: checkout.invoice_creation?.enabled ? "pending" : "unavailable" }, 200);
    }
    const invoiceId = typeof checkout.invoice === "string" ? checkout.invoice : checkout.invoice.id;
    const [invoice, creditNotes] = await Promise.all([
      getStripeInvoice(invoiceId),
      getStripeCreditNotes(invoiceId),
    ]);
    if (invoice.id !== invoiceId || invoice.status !== "paid" || !invoice.hosted_invoice_url) {
      return json({ status: "pending" }, 200);
    }
    return json({
      status: "ready",
      number: invoice.number || null,
      url: invoice.hosted_invoice_url,
      pdf: invoice.invoice_pdf || null,
      creditNotes: (creditNotes?.data || []).filter((note) => note.status === "issued" && note.pdf).map((note) => ({
        number: note.number || null,
        pdf: note.pdf,
      })),
    });
  } catch {
    return json({ error: "invoice_unavailable" }, 503);
  }
}
