import { defineCliConfig } from "sanity/cli";
import { requireSanityDataset } from "./sanity/project.js";

const { projectId, dataset } = requireSanityDataset();

export default defineCliConfig({
  api: { projectId, dataset },
});
