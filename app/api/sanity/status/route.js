import { getSanityConfigurationStatus } from "@/lib/sanity/config";
import { SANITY_EDITORIAL_REVALIDATE_SECONDS } from "@/lib/sanity/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getSanityConfigurationStatus();
  return Response.json({
    projectId: status.projectId,
    apiVersion: status.apiVersion,
    dataset: status.dataset,
    publicReadReady: status.publicReadReady,
    previewReady: status.previewReady,
    revalidationReady: status.revalidationReady,
    revalidationFallbackSeconds: SANITY_EDITORIAL_REVALIDATE_SECONDS,
    seedReady: status.seedReady,
    configurationValid: status.configurationValid,
    conflictFields: status.conflictFields,
    missing: status.missing,
  });
}
