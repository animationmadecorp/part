import { anyApi } from "convex/server";
import { getAuthenticatedConvexClient, getClerkSession, accessStatus } from "@/lib/server-auth";

const getAdminFileDownload = anyApi.adminRequests.getAdminFileDownload;

function safeFilename(value) {
  const normalized = String(value || "document")
    .replace(/[\r\n"\\/]/g, "_")
    .replace(/[^\w. -]/g, "_")
    .trim();
  return normalized || "document";
}

function errorResponse(status, message) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function safeMimeType(value) {
  return typeof value === "string" && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(value)
    ? value
    : "application/octet-stream";
}

export async function GET(request, { params }) {
  const { requestId, fileId } = await params;
  if (typeof requestId !== "string" || !requestId || typeof fileId !== "string" || !fileId) {
    return errorResponse(404, "Fichier introuvable");
  }

  const session = await getClerkSession();
  if (!session.authenticated) return errorResponse(accessStatus(session.reason), "Connexion requise");
  const serverSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!serverSecret) return errorResponse(503, "Le fichier est momentanément indisponible");
  const convex = await getAuthenticatedConvexClient(session);
  if (!convex.ok) return errorResponse(503, "Le fichier est momentanément indisponible");

  let file;
  try {
    file = await convex.client.query(getAdminFileDownload, { requestId, fileId, serverSecret });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/FORBIDDEN|UNAUTHENTICATED/i.test(message)) return errorResponse(403, "Accès refusé");
    if (/NOT_FOUND|INVALID_STATE/i.test(message)) return errorResponse(404, "Fichier introuvable");
    return errorResponse(503, "Le fichier est momentanément indisponible");
  }

  let upstream;
  try {
    upstream = await fetch(file.url, { cache: "no-store", redirect: "error" });
  } catch {
    return errorResponse(503, "Le fichier est momentanément indisponible");
  }
  if (!upstream.ok || !upstream.body) return errorResponse(404, "Fichier introuvable");

  const filename = safeFilename(file.name);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const mimeType = safeMimeType(file.mimeType);
  const inlinePdf = mimeType === "application/pdf" && !download;
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": inlinePdf ? "application/pdf" : "application/octet-stream",
    "Content-Disposition": `${inlinePdf ? "inline" : "attachment"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "X-Download-Options": "noopen",
  });
  if (Number.isSafeInteger(file.size) && file.size > 0) headers.set("Content-Length", String(file.size));
  return new Response(upstream.body, { status: 200, headers });
}
