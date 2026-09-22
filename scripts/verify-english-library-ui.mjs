import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import * as esbuild from "esbuild";

const root = process.cwd();
const tempDir = await mkdtemp(join(root, ".am-english-ui-"));
const bundlePath = join(tempDir, "EnglishLibrary.cjs");
const source = await readFile(new URL("../app/nouveau/bibliotheque/EnglishLibrary.js", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../app/nouveau/bibliotheque/english-library.css", import.meta.url), "utf8");
assert.match(source, /viewerMatches/);
assert.match(source, /scrollIntoView/);
assert.match(source, /focusedSlugRef/);
assert.match(source, /17 leçons pour t’entraîner, incluses dès ton premier cours d’anglais/);
assert.match(styleSource, /\.am-english-library-locked h2[\s\S]*color: #ffffff/);
assert.match(styleSource, /\.am-english-library-header h2 em[\s\S]*color: #ffffff/);
assert.match(styleSource, /\.am-new \.am-english-link[\s\S]*color: #ffffff/);
assert.match(styleSource, /\.am-new \.am-english-resume[\s\S]*color: #ffffff/);
assert.match(styleSource, /\.am-english-library-header :is\(button, a\):focus-visible/);
assert.match(styleSource, /\.am-english-lesson-card[\s\S]*color: #111111/);

const mockModules = {
  "@clerk/nextjs": `
    export function useAuth() { return globalThis.__englishLibraryUiMock.clerk; }
  `,
  "convex/react": `
    export function useConvexAuth() { return globalThis.__englishLibraryUiMock.convexAuth; }
    export function useConvexConnectionState() { return globalThis.__englishLibraryUiMock.connection; }
    export function useQuery_experimental({ query, args }) {
      if (args === "skip") return { status: "pending", data: undefined };
      return globalThis.__englishLibraryUiMock.queries[query] || { status: "pending", data: undefined };
    }
    export function useMutation(name) {
      return (...args) => globalThis.__englishLibraryUiMock.mutate(name, args);
    }
  `,
  "lucide-react": `
    import * as React from "react";
    const Icon = (props) => React.createElement("span", props);
    export const BookOpen = Icon;
    export const Check = Icon;
    export const ChevronRight = Icon;
    export const LockKeyhole = Icon;
    export const X = Icon;
  `,
  "next/link": `
    import * as React from "react";
    export default function Link(props) { return React.createElement("a", props, props.children); }
  `,
};

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["app/nouveau/bibliotheque/EnglishLibrary.js"],
  outfile: bundlePath,
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  loader: { ".js": "jsx" },
  external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  plugins: [{
    name: "english-library-ui-test-mocks",
    setup(build) {
      build.onResolve({ filter: /^(@clerk\/nextjs|convex\/react|lucide-react|next\/link)$/ }, (args) => ({
        path: args.path,
        namespace: "english-library-ui-test-mock",
      }));
      build.onLoad({ filter: /.*/, namespace: "english-library-ui-test-mock" }, (args) => ({
        contents: mockModules[args.path],
        loader: "js",
      }));
      build.onResolve({ filter: /EnglishLessonBody$/ }, () => ({
        path: "english-body",
        namespace: "english-library-ui-body",
      }));
      build.onLoad({ filter: /.*/, namespace: "english-library-ui-body" }, () => ({
        contents: `import * as React from "react"; export default function EnglishLessonBody({ children }) { return React.createElement("div", { className: "en-prose" }, children); }`,
        loader: "js",
      }));
      build.onResolve({ filter: /\.css$/ }, () => ({
        path: "english-library-css",
        namespace: "english-library-ui-css",
      }));
      build.onLoad({ filter: /.*/, namespace: "english-library-ui-css" }, () => ({
        contents: "export default {};",
        loader: "js",
      }));
    },
  }],
});

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost:3010/nouveau/bibliotheque",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const name of ["HTMLElement", "HTMLButtonElement", "Event", "MouseEvent", "Node"]) {
  globalThis[name] = dom.window[name];
}

let nextFrameId = 1;
const pendingFrames = new Map();
window.requestAnimationFrame = (callback) => {
  const id = nextFrameId++;
  pendingFrames.set(id, callback);
  return id;
};
window.cancelAnimationFrame = (id) => pendingFrames.delete(id);
globalThis.requestAnimationFrame = window.requestAnimationFrame;
let scrollCalls = 0;
dom.window.HTMLElement.prototype.scrollIntoView = () => { scrollCalls += 1; };

const indexA = {
  viewerId: "user-a",
  access: "granted",
  lessonCount: 2,
  completedCount: 0,
  lastOpenedSlug: null,
  lessons: [
    { slug: "present-simple", title: "Present simple", category: "Tenses", position: 0, progress: null },
    { slug: "present-continuous", title: "Present continuous", category: "Tenses", position: 1, progress: null },
  ],
};
const detailA = (progress = null) => ({
  viewerId: "user-a",
  access: "granted",
  lesson: { slug: "present-simple", title: "Present simple", category: "Tenses", body: "Private body A", progress },
});
let rejectOpening;
const openingPromise = new Promise((_, reject) => { rejectOpening = reject; });
let recordCalls = 0;
globalThis.__englishLibraryUiMock = {
  clerk: { isLoaded: true, userId: "user-a" },
  convexAuth: { isAuthenticated: true, isLoading: false },
  connection: { hasEverConnected: false, isWebSocketConnected: true },
  queries: {
    "englishLessons:getMyEnglishLessons": { status: "success", data: indexA },
    "englishLessons:getMyEnglishLesson": { status: "pending", data: undefined },
  },
  mutate(name) {
    if (name === "englishLessons:recordLessonOpened") {
      recordCalls += 1;
      return openingPromise;
    }
    return Promise.resolve({ completed: true });
  },
};

const require = createRequire(import.meta.url);
const EnglishLibrary = require(bundlePath).default;
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
const rootElement = document.getElementById("root");
const reactRoot = createRoot(rootElement);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const render = async (props = {}) => {
  await act(async () => {
    reactRoot.render(React.createElement(EnglishLibrary, props));
    await tick();
  });
};
const flushFrames = async () => {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  await act(async () => {
    callbacks.forEach((callback) => callback(Date.now()));
    await tick();
  });
};

await render();
const firstCard = rootElement.querySelector(".am-english-lesson-card");
assert.ok(firstCard, "the lesson index mounts for the entitled account");
await act(async () => {
  firstCard.click();
  await tick();
});
assert.equal(recordCalls, 1, "opening a lesson records the private resume point");

globalThis.__englishLibraryUiMock.queries["englishLessons:getMyEnglishLesson"] = { status: "success", data: detailA() };
await render();
assert.match(rootElement.textContent, /Private body A/);
assert.ok(pendingFrames.size > 0, "reader focus/scroll is scheduled after private content arrives");

// Simulate a Convex progress refresh before the first focus frame runs. The
// cancelled frame must not lose focus permanently; the next frame is allowed
// to complete the same reader transition.
globalThis.__englishLibraryUiMock.queries["englishLessons:getMyEnglishLesson"] = { status: "success", data: detailA({ lastOpenedAt: Date.now() }) };
await render();
await flushFrames();
assert.equal(scrollCalls, 1, "the reader scrolls into view after an intermediate query refresh");
assert.equal(document.activeElement?.id, "am-english-reader-title", "the reader heading receives focus");

const closeButton = rootElement.querySelector(".am-english-reader-close");
await act(async () => {
  closeButton.click();
  await tick();
});
await flushFrames();
assert.equal(document.activeElement, firstCard, "closing the reader restores focus to its lesson card");

indexA.lastOpenedSlug = "present-simple";
await render();
const resumeButton = [...rootElement.querySelectorAll("button")].find((button) => button.textContent.includes("Reprendre"));
assert.ok(resumeButton, "the last opened lesson is offered again after a reload-like render");

// Keep A's successful response in the Convex cache while Clerk switches to B.
// The stale A body must never be rendered for B.
globalThis.__englishLibraryUiMock.clerk = { isLoaded: true, userId: "user-b" };
await render();
assert.match(rootElement.textContent, /Vérification de ton identité/);
assert.doesNotMatch(rootElement.textContent, /Private body A/);
rejectOpening(new Error("late A mutation"));
await act(async () => { await tick(); await tick(); });
assert.doesNotMatch(rootElement.textContent, /reprise n’a pas pu être enregistrée/);

globalThis.__englishLibraryUiMock.queries["englishLessons:getMyEnglishLessons"] = {
  status: "success",
  data: { viewerId: "user-b", access: "locked", lessonCount: 2, completedCount: 0, lastOpenedSlug: null, lessons: [] },
};
await render();
assert.match(rootElement.textContent, /Tes leçons t’attendent ici/);
assert.doesNotMatch(rootElement.textContent, /Private body A/);

await act(async () => {
  reactRoot.unmount();
  await tick();
});
await rm(tempDir, { recursive: true, force: true });
console.log("English library UI verifier: PASS (reader focus, resume, stale identity response and late mutation isolation)");
