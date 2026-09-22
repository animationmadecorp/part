import { readFile } from "node:fs/promises";

const env = { ...process.env };

try {
  const localEnv = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || env[match[1]]) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch {
  // The process environment can still provide every value in CI or a shell.
}

const required = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CONVEX_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "BOOKING_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_TEST_RECIPIENTS",
  "RESEND_SEND_ENABLED",
];
const missing = required.filter((key) => !String(env[key] || "").trim());
const invalid = [];
if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  invalid.push("STRIPE_SECRET_KEY (must start with sk_test_)");
}
const resendEnabled = String(env.RESEND_SEND_ENABLED || "");
if (!missing.includes("RESEND_SEND_ENABLED") && !["true", "false"].includes(resendEnabled)) {
  invalid.push("RESEND_SEND_ENABLED (must be explicitly true or false)");
}

if (missing.length || invalid.length) {
  console.error("booking external preflight: NOT READY");
  if (missing.length) console.error(`missing: ${missing.join(", ")}`);
  if (invalid.length) console.error(`invalid: ${invalid.join(", ")}`);
  console.error("Convex dev must also mirror BOOKING_WEBHOOK_SECRET and the Resend variables before its durable consumer can send.");
  process.exitCode = 2;
} else {
  const mode = resendEnabled === "false" ? "Resend sending disabled" : "Resend sending enabled for the explicit allow-list only";
  console.log(`booking external preflight: READY (${mode}; provider calls still require explicit E2E approval)`);
}
