import { getAuthFoundationConfig } from "../lib/auth-config.js";
import { getResendConfig } from "../lib/resend-server.mjs";
import { safeAppOrigin } from "../convex/notificationTemplates.js";

function isHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

const production = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
const foundation = getAuthFoundationConfig(process.env);
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim() || "";
const appUrlConfigured = typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.trim().length > 0;
const appUrlHttps = isHttpsUrl(process.env.NEXT_PUBLIC_APP_URL);
const convexUrlHttps = isHttpsUrl(process.env.NEXT_PUBLIC_CONVEX_URL);
const resendAppUrl = process.env.RESEND_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || null;
const resendConfig = getResendConfig(process.env);
const resendAppOriginSafe = Boolean(safeAppOrigin(resendAppUrl, { production: production || resendConfig.production }));
const resendProductionOptIn = resendConfig.productionEnabled;
const resendTestGate = process.env.RESEND_SEND_ENABLED === "true";
const resendProviderConfigured = Boolean(resendConfig.apiKey && resendConfig.from);
const resendModeIsProduction = resendConfig.mode === "production";
const resendGateOpen = resendTestGate || resendProductionOptIn;
const requestedPreflightMode = process.env.AM_PREFLIGHT_MODE?.trim() || "prepare";
const preflightMode = requestedPreflightMode === "live" || requestedPreflightMode === "prepare"
  ? requestedPreflightMode
  : "invalid";
const liveReadiness = preflightMode === "live";
const effectiveResendSendGate = Boolean(
  resendConfig.enabled &&
  (!production || resendConfig.production) &&
  resendAppOriginSafe,
);

const report = {
  runtime: {
    environment: production ? "production" : process.env.NODE_ENV || "unknown",
    production,
    preflightMode,
  },
  clerk: {
    configured: foundation.clerkConfigured,
    convexConfigured: foundation.convexConfigured,
    foundationConfigured: foundation.foundationConfigured,
    missing: foundation.missing,
    convexUrlHttps,
    publishableKeyLooksLive: /^pk_live_/.test(clerkPublishableKey),
    secretKeyLooksLive: /^sk_live_/.test(clerkSecretKey),
  },
  publicAppUrl: {
    configured: appUrlConfigured,
    httpsInProduction: !production || appUrlHttps,
  },
  notifications: {
    appOriginConfigured: Boolean(resendAppUrl),
    appOriginSafe: resendAppOriginSafe,
    providerConfigured: resendProviderConfigured,
    mode: resendConfig.mode,
    modeIsProduction: resendModeIsProduction,
    allowlistRequired: resendConfig.allowlistRequired,
    explicitProductionMode: resendConfig.production,
    testGateEnabled: resendTestGate,
    productionOptIn: resendProductionOptIn,
    gateOpen: resendGateOpen,
    sendPolicy: liveReadiness ? "live-enabled-shape" : "no-send-preparation",
    effectiveSendGate: effectiveResendSendGate,
  },
};

const failures = [];
function fail(code, message) {
  failures.push({ code, message });
}

if (production && !foundation.foundationConfigured) fail("AUTH_FOUNDATION", "Clerk/Convex foundation incomplete");
if (preflightMode === "invalid") fail("PREFLIGHT_MODE", "AM_PREFLIGHT_MODE must be prepare or live");
if (production && !/^pk_live_/.test(clerkPublishableKey)) fail("CLERK_PUBLIC_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a live key");
if (production && !/^sk_live_/.test(clerkSecretKey)) fail("CLERK_SECRET_KEY", "CLERK_SECRET_KEY must be a live key");
if (production && !convexUrlHttps) fail("CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL must use HTTPS");
if (production && (!appUrlConfigured || !appUrlHttps)) fail("APP_URL", "NEXT_PUBLIC_APP_URL must be an HTTPS URL");
if (production && !resendAppOriginSafe) fail("EMAIL_ORIGIN", "RESEND_APP_URL or NEXT_PUBLIC_APP_URL must be a safe non-loopback origin");
if (production && !resendProviderConfigured) fail("EMAIL_PROVIDER", "RESEND_API_KEY and RESEND_FROM_EMAIL are required for production notifications");
if (production && !resendModeIsProduction) fail("EMAIL_MODE", "RESEND_SEND_MODE must be production");
if (production && !liveReadiness && resendGateOpen) fail("EMAIL_SEND_GATE", "RESEND_SEND_ENABLED and RESEND_PRODUCTION_SEND_ENABLED must remain false in prepare mode");
if (production && liveReadiness && !resendTestGate) fail("EMAIL_SEND_GATE", "RESEND_SEND_ENABLED must be true in live mode");
if (production && liveReadiness && !resendProductionOptIn) fail("EMAIL_PRODUCTION_OPT_IN", "RESEND_PRODUCTION_SEND_ENABLED must be true in live mode");

console.log("Production auth preflight");
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error(`FAIL: ${failures.map(({ code, message }) => `[${code}] ${message}`).join("; ")}`);
  process.exitCode = 1;
} else {
  console.log(
    production
      ? liveReadiness
        ? "PASS: live configuration shape is coherent; this preflight sent no email."
        : "PASS: production no-send preparation is coherent; live email activation remains a separate human gate."
      : "PASS: local report only; production checks activate in production mode.",
  );
}
