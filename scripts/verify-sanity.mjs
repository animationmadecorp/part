import nextEnv from "@next/env";
import { createClient } from "@sanity/client";
import { getSanityEnvironment } from "../sanity/project.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const { projectId, dataset, apiVersion, conflictFields = [] } = getSanityEnvironment();

async function main() {
  const missing = [];
  if (conflictFields.length) missing.push(`configuration conflict: ${conflictFields.join(", ")}`);
  if (!dataset) missing.push("SANITY_DATASET/NEXT_PUBLIC_SANITY_DATASET");

  if (missing.length) {
    console.log(JSON.stringify({
      projectId: projectId || null,
      dataset: dataset || null,
      access: "not-tested",
      missing,
      message: conflictFields.length
        ? "La configuration Sanity est contradictoire ; aucune requête distante n’a été déclarée réussie."
        : "Le projet est connu mais aucun dataset n’a été fourni ; aucune requête distante n’a été déclarée réussie.",
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const client = createClient({ projectId, dataset, apiVersion, useCdn: false, perspective: "published" });
  try {
    const result = await client.fetch(`count(*[!(_id in path("drafts.**")) && _type in ["siteSettings", "page", "offer", "resourcePresentation", "faq"]])`);
    console.log(JSON.stringify({ projectId, dataset, access: "readable", publishedEditorialDocuments: result }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      projectId,
      dataset,
      access: "failed",
      error: error instanceof Error ? error.message : String(error),
      message: "Le dataset est renseigné mais la lecture Sanity n’est pas démontrée.",
    }, null, 2));
    process.exitCode = 3;
  }
}

await main();
