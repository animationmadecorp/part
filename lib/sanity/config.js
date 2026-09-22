import { createClient } from "@sanity/client";
import { getSanityEnvironment } from "../../sanity/project.js";

let publishedClient;
let draftClient;

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
      useCdn: true,
      perspective: "published",
    });
  }
  return publishedClient;
}
