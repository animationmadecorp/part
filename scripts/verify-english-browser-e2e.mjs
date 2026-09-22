import assert from "node:assert/strict";
import { createRequire } from "node:module";

const root = "/Users/kaolla/Downloads/WORK/AM-CONTENT/AM-PLATEFORM";
const require = createRequire(`${root}/package.json`);
require("@next/env").loadEnvConfig(root);

assert(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"), "the browser recipe is DEV-only");
assert(process.env.NEXT_PUBLIC_CONVEX_URL?.includes("clever-bulldog-649"), "the browser recipe targets the authorized DEV Convex deployment");
assert(process.env.ENGLISH_RECETTE_USER_A, "ENGLISH_RECETTE_USER_A is required");
assert(process.env.ENGLISH_RECETTE_USER_B, "ENGLISH_RECETTE_USER_B is required");

const clerk = require("@clerk/backend").createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const { chromium } = require("/Users/kaolla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Users/kaolla/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});

const sessions = [];
const contexts = [];
const baseUrl = "http://localhost:3010";
const libraryUrl = `${baseUrl}/nouveau/bibliotheque?onglet=bibliotheque&lecon=present-simple`;

async function login(userId, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  contexts.push(context);
  const ticket = await clerk.signInTokens.createSignInToken({ userId, expiresInSeconds: 120 });
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded, null, { timeout: 30000 });
  const sessionId = await page.evaluate(async (token) => {
    const signIn = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: token });
    await window.Clerk.setActive({ session: signIn.createdSessionId });
    return signIn.createdSessionId;
  }, ticket.token);
  sessions.push(sessionId);
  await page.goto(libraryUrl, { waitUntil: "domcontentloaded" });
  await waitForLibraryState(page);
  return page;
}

async function waitForLibraryState(page) {
  await page.waitForFunction(() => {
    return Boolean(document.querySelector(".am-english-library-locked, .am-english-library-error"))
      || document.querySelectorAll(".am-english-lesson-card").length === 17;
  }, null, { timeout: 30000 });
}

async function pageState(page) {
  const text = await page.locator("body").innerText();
  const lessonCardCount = await page.locator(".am-english-lesson-card").count();
  const readerBody = page.locator(".am-english-reader-body");
  const readerBodyText = await readerBody.count() ? await readerBody.innerText() : "";
  const firstLesson = page.locator(".am-english-lesson-card").first();
  return {
    text,
    lessonBody: Boolean(readerBodyText.trim()),
    lessonCount: lessonCardCount === 17,
    firstLessonCompleted: await firstLesson.locator(".am-english-lesson-check.is-complete").count() > 0,
    locked: text.includes("Tes leçons t’attendent ici."),
    error: Boolean(await page.locator(".am-english-library-error").count()),
  };
}

async function waitForCompletion(page) {
  await page.locator(".am-english-lesson-card").first().locator(".am-english-lesson-check.is-complete").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Marquée comme terminée/ }).waitFor({ timeout: 30000 });
}

async function waitForAnonymousState(page) {
  await page.waitForFunction(() => document.body.innerText.includes("Connecte-toi pour continuer."), null, { timeout: 30000 });
}

try {
  const a = await login(process.env.ENGLISH_RECETTE_USER_A, { width: 1440, height: 1000 });
  let aBefore = await pageState(a);
  if (aBefore.lessonCount && !aBefore.error) {
    await a.getByRole("heading", { name: "Present simple", exact: true }).waitFor({ timeout: 30000 });
    aBefore = await pageState(a);
  }
  const aAccess = aBefore.lessonCount ? "granted" : aBefore.locked ? "locked" : aBefore.error ? "error" : "unknown";
  assert.notEqual(aAccess, "unknown", "account A must resolve to a granted or locked state");
  assert.notEqual(aAccess, "error", "account A must not render the English error state");
  await a.locator(".am-english-library").screenshot({ path: "/private/tmp/am-english-recette-a-desktop.png" });

  let aProgress = { status: "SKIPPED", reason: "fixture A has no English entitlement" };
  let aMobileState = { lessonBody: false, overflow: false, tables: 0 };
  if (aAccess === "granted") {
    await a.getByRole("button", { name: /01 Tenses Present simple/ }).click();
    await a.getByRole("heading", { name: "Present simple", exact: true }).waitFor();
    if (await a.getByRole("button", { name: "Marquer comme terminée" }).count()) {
      await a.getByRole("button", { name: "Marquer comme terminée" }).click();
    }
    await waitForCompletion(a);
    await a.reload({ waitUntil: "domcontentloaded" });
    await waitForLibraryState(a);
    await a.getByRole("heading", { name: "Present simple", exact: true }).waitFor({ timeout: 30000 });
    const aAfterReload = await pageState(a);
    aProgress = {
      status: aAfterReload.lessonBody && aAfterReload.lessonCount && aAfterReload.firstLessonCompleted && aAfterReload.text.includes("Reprendre : Present simple") ? "PASS" : "FAIL",
      reason: "first lesson completion survives a real reload",
    };
    assert.equal(aProgress.status, "PASS", "account A completion must survive a real reload");

    await a.setViewportSize({ width: 390, height: 844 });
    await a.goto(`${baseUrl}/nouveau/bibliotheque?onglet=bibliotheque&lecon=auxiliaries`, { waitUntil: "domcontentloaded" });
    await waitForLibraryState(a);
    await a.getByRole("heading", { name: "Auxiliaries", exact: true }).waitFor();
    const mobileState = await pageState(a);
    const mobileMetrics = await a.evaluate(() => ({
      innerWidth: window.innerWidth,
      bodyWidth: document.body.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      tables: document.querySelectorAll(".am-english-reader table").length,
      tableOverflow: [...document.querySelectorAll(".am-english-reader table")].every((table) => getComputedStyle(table).overflowX === "auto"),
    }));
    assert.equal(mobileState.lessonBody, true, "account A mobile reader must show the private lesson");
    assert.equal(mobileMetrics.overflow, false, "the mobile reader must not overflow the page");
    assert.ok(mobileMetrics.tables > 0, "the mobile reader must render lesson tables");
    assert.equal(mobileMetrics.tableOverflow, true, "lesson tables must use the bounded mobile overflow style");
    await a.locator(".am-english-reader").screenshot({ path: "/private/tmp/am-english-recette-a-mobile.png" });
    aMobileState = { lessonBody: mobileState.lessonBody, overflow: mobileMetrics.overflow, tables: mobileMetrics.tables };
  } else {
    await a.setViewportSize({ width: 390, height: 844 });
    await a.goto(libraryUrl, { waitUntil: "domcontentloaded" });
    await waitForLibraryState(a);
    const mobileState = await pageState(a);
    const mobileMetrics = await a.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      tables: document.querySelectorAll(".am-english-reader table").length,
    }));
    assert.equal(mobileState.lessonBody, false, "a locked account must not receive a mobile lesson body");
    assert.equal(mobileMetrics.overflow, false, "the locked mobile state must not overflow the page");
    await a.locator(".am-english-library").screenshot({ path: "/private/tmp/am-english-recette-a-mobile.png" });
    aMobileState = { lessonBody: mobileState.lessonBody, overflow: mobileMetrics.overflow, tables: mobileMetrics.tables };
  }

  const b = await login(process.env.ENGLISH_RECETTE_USER_B, { width: 1440, height: 1000 });
  const bState = await pageState(b);
  await b.locator(".am-english-library").screenshot({ path: "/private/tmp/am-english-recette-b-desktop.png" });
  assert.equal(bState.lessonBody, false, "account B must not receive account A lesson bodies");
  assert.equal(bState.locked, true, "account B must remain locked without an English entitlement");
  const bVisual = await b.getByRole("link", { name: "Découvrir les cours" }).evaluate((link) => {
    const parent = link.closest(".am-english-library-locked");
    const style = getComputedStyle(link);
    const heading = parent?.querySelector("h2");
    const icon = parent?.querySelector("svg");
    link.focus();
    const focusStyle = getComputedStyle(link);
    return {
      linkColor: style.color,
      headingColor: heading ? getComputedStyle(heading).color : null,
      iconColor: icon ? getComputedStyle(icon).color : null,
      focusOutline: focusStyle.outlineColor,
    };
  });
  assert.equal(bVisual.linkColor, "rgb(255, 255, 255)", "the locked-state CTA must be white on lavender");
  assert.equal(bVisual.headingColor, "rgb(255, 255, 255)", "the locked-state heading must be white on lavender");
  assert.equal(bVisual.iconColor, "rgb(255, 255, 255)", "the locked-state icon must be white on lavender");
  assert.equal(bVisual.focusOutline, "rgb(255, 255, 255)", "the locked-state focus ring must remain visible on lavender");

  await b.goto(`${baseUrl}/anglais/lessons/present-simple`, { waitUntil: "domcontentloaded" });
  await waitForLibraryState(b);
  const bLegacyState = await pageState(b);
  assert.match(await b.url(), /\/nouveau\/bibliotheque/);
  assert.equal(bLegacyState.lessonBody, false, "legacy route must not bypass account B access");

  const anonymousContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(anonymousContext);
  const anonymous = await anonymousContext.newPage();
  await anonymous.goto(libraryUrl, { waitUntil: "domcontentloaded" });
  await waitForAnonymousState(anonymous);
  const anonymousState = await pageState(anonymous);
  await anonymous.screenshot({ path: "/private/tmp/am-english-recette-anonymous.png", fullPage: true });
  assert.equal(anonymousState.lessonBody, false, "anonymous browser must not receive lesson bodies");

  await anonymous.goto(`${baseUrl}/anglais/lessons/present-simple`, { waitUntil: "domcontentloaded" });
  await waitForAnonymousState(anonymous);
  const anonymousLegacyState = await pageState(anonymous);
  assert.equal(anonymousLegacyState.lessonBody, false, "anonymous legacy route must not receive lesson bodies");

  console.log(JSON.stringify({
    result: "PASS",
    accountA: { access: aAccess, progressReload: aProgress, mobile: aMobileState },
    accountB: { locked: bState.locked, noBody: !bState.lessonBody, legacyNoBody: !bLegacyState.lessonBody, visual: bVisual },
    anonymous: { noBody: !anonymousState.lessonBody, legacyNoBody: !anonymousLegacyState.lessonBody },
    screenshots: [
      "/private/tmp/am-english-recette-a-desktop.png",
      "/private/tmp/am-english-recette-a-mobile.png",
      "/private/tmp/am-english-recette-b-desktop.png",
      "/private/tmp/am-english-recette-anonymous.png",
    ],
  }));
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  for (const sessionId of sessions) await clerk.sessions.revokeSession(sessionId);
}
