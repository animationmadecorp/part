import { defineCliConfig } from "sanity/cli";
import { requireSanityDataset } from "./sanity/project.js";

const { projectId, dataset } = requireSanityDataset();

export default defineCliConfig({
  api: { projectId, dataset },
  // Do not copy the website's public/ directory into the hosted Studio.
  vite: { publicDir: false },
  // Keep the hosted Studio on the versions shipped by this repository.
  deployment: { appId: "immcgmorj3khyr4qcpd4gvh3", autoUpdates: false },
});
