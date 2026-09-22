import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/kaolla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Users/kaolla/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});

const screenshots = [];
const landingUrl = "http://localhost:3010/nouveau";

async function verifyViewport(name, viewport, screenshotPath) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    await page.goto(landingUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector(".am-hero") && document.querySelectorAll(".am-offer").length === 4, null, { timeout: 30000 });
    const state = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      bodyWidth: document.body.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hero: document.querySelector(".am-hero")?.innerText || "",
      offers: document.querySelectorAll(".am-offer").length,
      sections: document.querySelectorAll(".am-section").length,
      hasBio: document.body.innerText.includes("Moi, c’est"),
      hasGifts: document.body.innerText.includes("Des ressources gratuites"),
      hasProblems: document.body.innerText.includes("Ces offres te seront"),
    }));
    assert.match(state.hero, /Faire de ton talent/);
    assert.equal(state.offers, 4);
    assert.ok(state.sections >= 2);
    assert.equal(state.hasBio, true);
    assert.equal(state.hasGifts, true);
    assert.equal(state.hasProblems, true);
    assert.equal(state.scrollWidth > state.innerWidth, false, `${name} landing must not overflow horizontally`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshots.push(screenshotPath);
    return { name, ...state };
  } finally {
    await context.close();
  }
}

try {
  const desktop = await verifyViewport("desktop", { width: 1440, height: 1000 }, "/private/tmp/am-landing-fallback-desktop.png");
  const mobile = await verifyViewport("mobile", { width: 390, height: 844 }, "/private/tmp/am-landing-fallback-mobile.png");
  console.log(JSON.stringify({ result: "PASS", desktop, mobile, screenshots }));
} finally {
  await browser.close();
}
