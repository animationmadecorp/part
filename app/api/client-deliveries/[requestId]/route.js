import { anyApi } from "convex/server";
import { getAuthenticatedConvexClient, getClerkSession, accessStatus } from "@/lib/server-auth";

const getDeliveryDownload = anyApi.clientDeliveries.getMyDeliveryDownload;

function safeFilename(value) {
  const normalized = String(value || "document.pdf")
    .replace(/[\r\n"\\/]/g, "_")
    .replace(/[^\w. -]/g, "_")
    .trim();
  if (!normalized) return "document.pdf";
  return /\.pdf$/i.test(normalized) ? normalized : `${normalized}.pdf`;
}

function errorResponse(status, message) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request, { params }) {
  const { requestId } = await params;
  if (typeof requestId !== "string" || !requestId) return errorResponse(404, "Document introuvable");

  const session = await getClerkSession();
  if (!session.authenticated) return errorResponse(accessStatus(session.reason), "Connexion requise");
  const serverSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!serverSecret) return errorResponse(503, "Le document est momentanément indisponible");
  const convex = await getAuthenticatedConvexClient(session);
  if (!convex.ok) return errorResponse(503, "Le document est momentanément indisponible");

  let delivery;
  try {
    delivery = await convex.client.query(getDeliveryDownload, { requestId, serverSecret });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/FORBIDDEN|UNAUTHENTICATED/i.test(message)) return errorResponse(403, "Accès refusé");
    if (/NOT_FOUND|INVALID_STATE/i.test(message)) return errorResponse(404, "Document introuvable");
    return errorResponse(503, "Le document est momentanément indisponible");
  }

  let upstream;
  try {
    upstream = await fetch(delivery.url, { cache: "no-store", redirect: "error" });
  } catch {
    return errorResponse(503, "Le document est momentanément indisponible");
  }
  if (!upstream.ok || !upstream.body) return errorResponse(404, "Document introuvable");

  const filename = safeFilename(delivery.name);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": "application/pdf",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "X-Content-Type-Options": "nosniff",
  });
  if (Number.isSafeInteger(delivery.size) && delivery.size > 0) headers.set("Content-Length", String(delivery.size));
  return new Response(upstream.body, { status: 200, headers });
}
