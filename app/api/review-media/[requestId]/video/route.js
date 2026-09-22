import { anyApi } from "convex/server";
import { getAuthenticatedConvexClient, getClerkSession, accessStatus } from "@/lib/server-auth";

const getReviewVideoDownload = anyApi.reviewStudio.getReviewVideoDownload;

function errorResponse(status, message) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function safeFilename(value) {
  const normalized = String(value || "review-video")
    .replace(/[\r\n"\\/]/g, "_")
    .replace(/[^\w. -]/g, "_")
    .trim();
  return normalized || "review-video";
}

function safeMimeType(value) {
  return typeof value === "string" && /^video\/(mp4|quicktime)$/i.test(value)
    ? value.toLowerCase()
    : "application/octet-stream";
}

function copyUpstreamHeader(headers, upstream, name) {
  const value = upstream.headers.get(name);
  if (value) headers.set(name, value);
}

export async function GET(request, { params }) {
  const { requestId } = await params;
  if (typeof requestId !== "string" || !requestId) return errorResponse(404, "Vidéo introuvable");

  const session = await getClerkSession();
  if (!session.authenticated) return errorResponse(accessStatus(session.reason), "Connexion requise");
  const serverSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!serverSecret) return errorResponse(503, "La vidéo est momentanément indisponible");
  const convex = await getAuthenticatedConvexClient(session);
  if (!convex.ok) return errorResponse(503, "La vidéo est momentanément indisponible");
  const cycleValue = new URL(request.url).searchParams.get("cycle");
  const cycleNumber = cycleValue ? Number(cycleValue) : 1;
  if (!Number.isInteger(cycleNumber) || cycleNumber < 1 || cycleNumber > 2) return errorResponse(400, "Cycle de review invalide");
  const sourceFileId = new URL(request.url).searchParams.get("file") || undefined;

  let file;
  try {
    file = await convex.client.query(getReviewVideoDownload, { requestId, serverSecret, cycleNumber, ...(sourceFileId ? { sourceFileId } : {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNAUTHENTICATED/i.test(message)) return errorResponse(401, "Connexion requise");
    if (/FORBIDDEN/i.test(message)) return errorResponse(403, "Accès refusé");
    if (/NOT_FOUND|INVALID_STATE/i.test(message)) return errorResponse(404, "Vidéo introuvable");
    return errorResponse(503, "La vidéo est momentanément indisponible");
  }

  const range = request.headers.get("range");
  let upstream;
  try {
    upstream = await fetch(file.url, {
      cache: "no-store",
      redirect: "error",
      ...(range ? { headers: { Range: range } } : {}),
    });
  } catch {
    return errorResponse(503, "La vidéo est momentanément indisponible");
  }
  if (!upstream.ok && upstream.status !== 416) return errorResponse(404, "Vidéo introuvable");

  const filename = safeFilename(file.name);
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": safeMimeType(file.mimeType),
    "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  copyUpstreamHeader(headers, upstream, "content-range");
  copyUpstreamHeader(headers, upstream, "content-length");
  if (!headers.has("Content-Length") && !range && Number.isSafeInteger(file.size) && file.size > 0) {
    headers.set("Content-Length", String(file.size));
  }

  return new Response(upstream.body, {
    status: upstream.status === 206 || upstream.status === 416 ? upstream.status : 200,
    headers,
  });
}
