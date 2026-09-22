import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { requireSanityDataset } from "./sanity/project.js";
import { schemaTypes } from "./sanity/schemaTypes/index.js";

const { projectId, dataset, apiVersion } = requireSanityDataset();

export default defineConfig({
  name: "animation-made",
  title: "Animation Made",
  projectId,
  dataset,
  plugins: [
    structureTool(),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
  schema: { types: schemaTypes },
  document: {
    actions: (previous) => previous,
  },
});
