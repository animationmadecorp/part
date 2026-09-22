import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import * as esbuild from "esbuild";

const root = process.cwd();
const tempDir = await mkdtemp(join(root, ".am-planner-ui-"));
const bundlePath = join(tempDir, "Planner.cjs");

const mockModules = {
  "@clerk/nextjs": `
    export function useAuth() { return globalThis.__plannerUiMock.clerk; }
  `,
  "convex/react": `
    export function useConvexAuth() { return globalThis.__plannerUiMock.convexAuth; }
    export function useConvexConnectionState() { return globalThis.__plannerUiMock.connection; }
    export function useQuery_experimental({ query, args }) {
      if (args === "skip") return { status: "pending", data: undefined };
      return globalThis.__plannerUiMock.queries[query] || { status: "pending", data: undefined };
    }
    export function useMutation(name) {
      return (...args) => globalThis.__plannerUiMock.mutate(name, args);
    }
  `,
  "lucide-react": `
    import * as React from "react";
    const Icon = (props) => React.createElement("span", props);
    export const ChevronLeft = Icon;
    export const ChevronRight = Icon;
    export const Plus = Icon;
    export const Printer = Icon;
    export const Trash2 = Icon;
    export const X = Icon;
  `,
};

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["app/nouveau/bibliotheque/Planner.js"],
  outfile: bundlePath,
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  loader: { ".js": "jsx" },
  external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  plugins: [{
    name: "planner-ui-test-mocks",
    setup(build) {
      build.onResolve({ filter: /^(@clerk\/nextjs|convex\/react|lucide-react)$/ }, (args) => ({
        path: args.path,
        namespace: "planner-ui-test-mock",
      }));
      build.onLoad({ filter: /.*/, namespace: "planner-ui-test-mock" }, (args) => ({
        contents: mockModules[args.path],
        loader: "js",
      }));
      build.onResolve({ filter: /\.css$/ }, () => ({
        path: "planner-css",
        namespace: "planner-ui-test-css",
      }));
      build.onLoad({ filter: /.*/, namespace: "planner-ui-test-css" }, () => ({
        contents: "export default {};",
        loader: "js",
      }));
    },
  }],
});

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost:3010/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const name of ["HTMLElement", "HTMLInputElement", "Event", "SubmitEvent", "MouseEvent", "Node"]) {
  globalThis[name] = dom.window[name];
}
window.print = () => {};
window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.requestAnimationFrame = window.requestAnimationFrame;

const dialogPrototype = dom.window.HTMLDialogElement?.prototype || dom.window.HTMLElement.prototype;
if (!Object.getOwnPropertyDescriptor(dialogPrototype, "open")) {
  Object.defineProperty(dialogPrototype, "open", {
    configurable: true,
    get() { return this.hasAttribute("open"); },
    set(value) { if (value) this.setAttribute("open", ""); else this.removeAttribute("open"); },
  });
}
dialogPrototype.showModal = function showModal() {
  this.open = true;
};
dialogPrototype.close = function close() {
  this.closeCalls = (this.closeCalls || 0) + 1;
  this.open = false;
  this.dispatchEvent(new dom.window.Event("close"));
};

let resolveCreate;
let mutationStarted = 0;
const pendingCreate = new Promise((resolve) => { resolveCreate = resolve; });
globalThis.__plannerUiMock = {
  clerk: { isLoaded: true, userId: "user-a" },
  convexAuth: { isAuthenticated: true, isLoading: false },
  connection: { hasEverConnected: false, isWebSocketConnected: true },
  queries: {
    "planner:getMyTasks": { status: "success", data: { viewerId: "user-a", tasks: [] } },
    "planner:getMyAppointments": { status: "success", data: { viewerId: "user-a", bookings: [] } },
  },
  mutate(name) {
    if (name === "planner:createTask") {
      mutationStarted += 1;
      return pendingCreate;
    }
    return Promise.resolve({ status: "ok" });
  },
};

const require = createRequire(import.meta.url);
const Planner = require(bundlePath).default;
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
const rootElement = document.getElementById("root");
const reactRoot = createRoot(rootElement);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const renderPlanner = async () => {
  await act(async () => {
    reactRoot.render(React.createElement(Planner, { active: true }));
    await tick();
    await tick();
  });
};
const findAddButton = () => [...rootElement.querySelectorAll("button")]
  .find((button) => button.textContent.includes("Ajouter une tâche"));

await renderPlanner();
const addButton = findAddButton();
assert.ok(addButton, "Planner mounts with its add button");

await act(async () => {
  addButton.click();
  await tick();
});
const dialog = rootElement.querySelector("dialog");
assert.equal(dialog.open, true, "the real Planner opens its dialog");
const cancelButton = rootElement.querySelector(".am-planner-cancel");
await act(async () => {
  cancelButton.click();
  await tick();
  await tick();
  await tick();
});
assert.equal(document.activeElement, addButton, "normal dialog close restores focus to its trigger");

await act(async () => {
  addButton.click();
  await tick();
});
const titleInput = rootElement.querySelector("input[name=title]");
const nativeValueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
await act(async () => {
  nativeValueSetter.call(titleInput, "Brouillon privé A");
  titleInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  titleInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await tick();
});
await act(async () => {
  rootElement.querySelector(".am-planner-dialog-actions button[type=submit]").click();
  await tick();
});
assert.equal(mutationStarted, 1, "the A create mutation is pending");

globalThis.__plannerUiMock.clerk = { isLoaded: true, userId: "user-b" };
globalThis.__plannerUiMock.queries = {
  "planner:getMyTasks": { status: "success", data: { viewerId: "user-b", tasks: [] } },
  "planner:getMyAppointments": { status: "success", data: { viewerId: "user-b", bookings: [] } },
};
await renderPlanner();
assert.equal(dialog.hidden, true, "the A dialog is hidden during the A→B transition");
assert.equal(dialog.open, false, "the A dialog is closed after the identity switch");
assert.equal(titleInput.value, "", "the A draft is not rendered for B");

await act(async () => {
  resolveCreate({ id: "late-a" });
  await tick();
  await tick();
});
assert.doesNotMatch(rootElement.querySelector(".am-planner-status").textContent, /Tâche enregistrée/, "a late A result cannot update B");

await act(async () => {
  reactRoot.unmount();
  await tick();
});
await rm(tempDir, { recursive: true, force: true });
console.log("planner UI identity, pending mutation and focus checks: PASS");
