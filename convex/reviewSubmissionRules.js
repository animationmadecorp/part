// Server-side limits for post-payment versions. The browser can provide a
// nicer form, but it never decides how many reviews an offer contains.

export const REVIEW_SUBMISSION_RULES = Object.freeze({
  "projet-animation": Object.freeze({
    offerKey: "projet-animation",
    kind: "animation",
    maxSubmissions: 2,
    maxCycles: 2,
    maxSourceFiles: 1,
    acceptsVideo: true,
  }),
  feedback: Object.freeze({
    offerKey: "feedback",
    kind: "feedback",
    maxSubmissions: 1,
    maxCycles: 1,
    maxSourceFiles: 3,
    acceptsVideo: true,
  }),
  review: Object.freeze({
    offerKey: "review",
    kind: "book",
    maxSubmissions: 2,
    maxCycles: 2,
    maxSourceFiles: 0,
    acceptsVideo: false,
  }),
});

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
export const MAX_SUBMISSION_BYTES = 1024 * 1024 * 1024;
const MAX_BOOK_LINK_LENGTH = 2048;
const MAX_BOOK_PASSWORD_LENGTH = 320;
const MAX_SUBMISSION_JSON_LENGTH = 100_000;

function invalid(message) {
  throw new Error(`INVALID_INPUT: ${message}`);
}

function text(value, field, { required = true, max = 6000 } = {}) {
  if (value === undefined || value === null) {
    if (!required) return "";
    invalid(`Missing ${field}`);
  }
  if (typeof value !== "string") invalid(`Invalid ${field}`);
  const normalized = value.trim();
  if (required && !normalized) invalid(`Missing ${field}`);
  if (normalized.length > max) invalid(`Invalid ${field}`);
  return normalized;
}

function url(value, field) {
  const normalized = text(value, field, { max: MAX_BOOK_LINK_LENGTH });
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("protocol");
  } catch {
    invalid(`Invalid ${field}`);
  }
  return normalized;
}

export function getReviewSubmissionRule(offerKey) {
  return REVIEW_SUBMISSION_RULES[offerKey] || null;
}

export function parseSubmissionPayload(payloadJson, field = "submission") {
  if (typeof payloadJson !== "string" || payloadJson.length > MAX_SUBMISSION_JSON_LENGTH) {
    invalid(`Invalid ${field} payload`);
  }
  let parsed;
  try { parsed = JSON.parse(payloadJson); } catch { invalid(`Invalid ${field} payload`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) invalid(`Invalid ${field} payload`);
  return parsed;
}

export function normalizeAnimationSubmission({
  name,
  mimeType,
  size,
  duration,
  fps,
  videoWidth,
  videoHeight,
}) {
  const normalizedName = text(name, "submission file name", { max: 180 });
  if (/[[\]{}<>\0\r\n]/.test(normalizedName)) invalid("Invalid submission file name");
  const normalizedMimeType = text(mimeType, "submission file type", { max: 120 }).toLowerCase();
  if (!VIDEO_MIME_TYPES.has(normalizedMimeType)) invalid("Animation submissions accept MP4 or MOV video only");
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_SUBMISSION_BYTES) invalid("Invalid submission file size");
  const normalizedDuration = Number(duration);
  if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0 || normalizedDuration > 15.05) {
    invalid("Animation submissions are limited to 15 seconds");
  }
  const normalizedFps = Number(fps || 24);
  if (!Number.isFinite(normalizedFps) || normalizedFps < 1 || normalizedFps > 120) invalid("Invalid submission frame rate");
  const width = Number(videoWidth);
  const height = Number(videoHeight);
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    invalid("Animation video dimensions are required");
  }
  return {
    name: normalizedName,
    mimeType: normalizedMimeType,
    size,
    duration: Math.round(normalizedDuration * 1000) / 1000,
    fps: Math.round(normalizedFps * 1000) / 1000,
    videoWidth: width,
    videoHeight: height,
  };
}

export function normalizeBookSubmission({ workLink, password }) {
  return {
    workLink: url(workLink, "book link"),
    password: text(password, "book password", { required: false, max: MAX_BOOK_PASSWORD_LENGTH }),
  };
}

export function normalizeBookReviewNotes({ summary, priorities, nextSteps }) {
  const normalized = {
    summary: text(summary, "book review summary"),
    priorities: text(priorities, "book review priorities"),
    nextSteps: text(nextSteps, "book review next steps"),
  };
  const serialized = JSON.stringify(normalized);
  if (serialized.length > MAX_SUBMISSION_JSON_LENGTH) invalid("Book review notes are too large");
  return normalized;
}

export function isVideoMimeType(mimeType) {
  return VIDEO_MIME_TYPES.has(String(mimeType || "").toLowerCase());
}
