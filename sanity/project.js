export const KNOWN_SANITY_PROJECT_ID = "ez6qtt5k";

function uniqueEnvironmentValues(values) {
  return [...new Set(values.map(({ value }) => value).filter((value) => typeof value === "string" && value.trim()))];
}

export function getSanityEnvironment() {
  const projectSources = [
    { name: "SANITY_PROJECT_ID", value: process.env.SANITY_PROJECT_ID },
    { name: "NEXT_PUBLIC_SANITY_PROJECT_ID", value: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID },
    { name: "SANITY_STUDIO_PROJECT_ID", value: process.env.SANITY_STUDIO_PROJECT_ID },
  ];
  const datasetSources = [
    { name: "SANITY_DATASET", value: process.env.SANITY_DATASET },
    { name: "NEXT_PUBLIC_SANITY_DATASET", value: process.env.NEXT_PUBLIC_SANITY_DATASET },
    { name: "SANITY_STUDIO_DATASET", value: process.env.SANITY_STUDIO_DATASET },
  ];
  const projectValues = uniqueEnvironmentValues(projectSources);
  const datasetValues = uniqueEnvironmentValues(datasetSources);
  const conflictFields = [
    ...(projectValues.length > 1 ? ["projectId"] : []),
    ...(datasetValues.length > 1 ? ["dataset"] : []),
  ];

  return {
    projectId: projectValues[0] || KNOWN_SANITY_PROJECT_ID,
    dataset: datasetValues[0] || "",
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01",
    conflictFields,
    hasConflict: conflictFields.length > 0,
  };
}

export function requireSanityDataset() {
  const environment = getSanityEnvironment();
  if (environment.hasConflict) {
    throw new Error(`Sanity configuration conflict: ${environment.conflictFields.join(", ")} resolve the duplicated environment values before starting Studio.`);
  }
  if (!environment.dataset) {
    throw new Error(
      "Sanity dataset missing: set SANITY_STUDIO_DATASET (Studio) or SANITY_DATASET/NEXT_PUBLIC_SANITY_DATASET (site).",
    );
  }
  return environment;
}
