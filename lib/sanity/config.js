import { createClient } from "@sanity/client";
import { getSanityEnvironment } from "../../sanity/project.js";

let publishedClient;
let draftClient;

export const SANITY_STUDIO_RECOMMENDED_URL = "https://animation-made.sanity.studio";

const LOCAL_STUDIO_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLocalStudioHostname(hostname) {
  const normalized = String(hostname || "")
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
  if (LOCAL_STUDIO_HOSTNAMES.has(normalized) || normalized.endsWith(".localhost")) return true;
  if (normalized === "0.0.0.0" || normalized === "::") return true;

  const ipv4 = normalized.split(".");
  if (ipv4.length === 4 && ipv4.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)) {
    return Number(ipv4[0]) === 127;
  }

  const mappedIpv4 = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  const mappedLoopback = Boolean(mappedIpv4 && (Number.parseInt(mappedIpv4[1], 16) & 0xff00) === 0x7f00);

  return normalized === "::1"
    || normalized === "0:0:0:0:0:0:0:1"
    || normalized.startsWith("::ffff:127.")
    || mappedLoopback;
}

export function getSanityStudioStatus(env = process.env) {
  const rawUrl = typeof env?.SANITY_STUDIO_URL === "string" ? env.SANITY_STUDIO_URL.trim() : "";
  const base = {
    configured: false,
    url: null,
    isLocal: false,
    recommendedUrl: SANITY_STUDIO_RECOMMENDED_URL,
    reason: "missing",
  };

  if (!rawUrl) return base;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ...base, reason: "invalid_url" };
  }

  if (!(["http:", "https:"].includes(url.protocol)) || !url.hostname || url.username || url.password) {
    return { ...base, reason: "invalid_url" };
  }

  const isLocal = isLocalStudioHostname(url.hostname);
  if (String(env?.NODE_ENV || "") === "production" && (isLocal || url.protocol !== "https:")) {
    return {
      ...base,
      isLocal,
      reason: isLocal ? "local_url_in_production" : "insecure_url_in_production",
    };
  }

  return {
    ...base,
    configured: true,
    url: url.toString().replace(/\/$/, ""),
    isLocal,
    reason: isLocal ? "local_development_url" : "configured",
  };
}

export function getSanityConfigurationStatus() {
  const { projectId, dataset, apiVersion, conflictFields = [] } = getSanityEnvironment();
  const projectConfigured = Boolean(projectId);
  const datasetConfigured = Boolean(dataset);
  const configurationValid = conflictFields.length === 0;
  const previewTokenConfigured = Boolean(process.env.SANITY_PREVIEW_TOKEN);
  const previewSecretConfigured = Boolean(process.env.SANITY_PREVIEW_SECRET);
  const revalidateSecretConfigured = Boolean(process.env.SANITY_REVALIDATE_SECRET);
  const writeTokenConfigured = Boolean(process.env.SANITY_WRITE_TOKEN);

  return {
    projectId,
    apiVersion,
    dataset: dataset || null,
    projectConfigured,
    datasetConfigured,
    configurationValid,
    conflictFields,
    publicReadReady: configurationValid && projectConfigured && datasetConfigured,
    previewReady: configurationValid && projectConfigured && datasetConfigured && previewTokenConfigured && previewSecretConfigured,
    revalidationReady: configurationValid && Boolean(revalidateSecretConfigured),
    seedReady: configurationValid && projectConfigured && datasetConfigured && writeTokenConfigured,
    missing: [
      ...(conflictFields.length ? [`configuration conflict: ${conflictFields.join(", ")}`] : []),
      ...(!projectConfigured ? ["SANITY_PROJECT_ID/NEXT_PUBLIC_SANITY_PROJECT_ID"] : []),
      ...(!datasetConfigured ? ["SANITY_DATASET/NEXT_PUBLIC_SANITY_DATASET"] : []),
      ...(!previewTokenConfigured ? ["SANITY_PREVIEW_TOKEN (aperçu brouillon)"] : []),
      ...(!previewSecretConfigured ? ["SANITY_PREVIEW_SECRET (URL d’aperçu)"] : []),
      ...(!revalidateSecretConfigured ? ["SANITY_REVALIDATE_SECRET (webhook)"] : []),
      ...(!writeTokenConfigured ? ["SANITY_WRITE_TOKEN (seed facultatif)"] : []),
    ],
  };
}

export function isSanityConfigured() {
  return getSanityConfigurationStatus().publicReadReady;
}

export function getSanityClient({ drafts = false } = {}) {
  const { projectId, dataset, apiVersion, hasConflict } = getSanityEnvironment();
  if (hasConflict || !projectId || !dataset) return null;

  if (drafts) {
    if (!process.env.SANITY_PREVIEW_TOKEN) return null;
    if (!draftClient) {
      draftClient = createClient({
        projectId,
        dataset,
        apiVersion,
        useCdn: false,
        perspective: "drafts",
        token: process.env.SANITY_PREVIEW_TOKEN,
      });
    }
    return draftClient;
  }

  if (!publishedClient) {
    publishedClient = createClient({
      projectId,
      dataset,
      apiVersion,
      // Next's tagged cache is the bounded fallback. Bypassing Sanity's CDN
      // keeps a signed webhook from invalidating Next onto another stale CDN
      // response after a publication.
      useCdn: false,
      perspective: "published",
    });
  }
  return publishedClient;
}
