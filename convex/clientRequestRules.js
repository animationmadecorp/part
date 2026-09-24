// Shared, framework-free invariants for the paid questionnaire dossiers.
// The browser may display a matching label, but only this catalog is allowed
// to decide the amount that reaches Stripe.
import { defaultPrice, formatPriceLabel, requestPriceKey } from "../lib/pricing-core.mjs";

export const CLIENT_REQUEST_OFFERS = Object.freeze({
  review: Object.freeze({
    key: "review",
    title: "Ta review personnalisée",
    description: "Guide PDF personnalisé · Sans visio",
    priceCents: defaultPrice(requestPriceKey("review")).priceCents,
    priceLabel: formatPriceLabel(defaultPrice(requestPriceKey("review")).priceCents, requestPriceKey("review")),
  }),
  contenu: Object.freeze({
    key: "contenu",
    title: "Ta direction de contenu",
    description: "Fiche personnalisée · Sans visio",
    priceCents: defaultPrice(requestPriceKey("contenu")).priceCents,
    priceLabel: formatPriceLabel(defaultPrice(requestPriceKey("contenu")).priceCents, requestPriceKey("contenu")),
  }),
  "projet-animation": Object.freeze({
    key: "projet-animation",
    title: "Ton projet d’animation",
    description: "Un plan · 15 secondes maximum · Sans visio",
    priceCents: defaultPrice(requestPriceKey("projet-animation")).priceCents,
    priceLabel: formatPriceLabel(defaultPrice(requestPriceKey("projet-animation")).priceCents, requestPriceKey("projet-animation")),
  }),
  feedback: Object.freeze({
    key: "feedback",
    title: "Ton feedback d’animation",
    description: "Jusqu’à 3 plans · 15 secondes cumulées · Sans visio",
    priceCents: defaultPrice(requestPriceKey("feedback")).priceCents,
    priceLabel: formatPriceLabel(defaultPrice(requestPriceKey("feedback")).priceCents, requestPriceKey("feedback")),
  }),
});

export const CLIENT_REQUEST_QUOTA_BYTES = 1024 * 1024 * 1024;
export const CLIENT_REQUEST_MAX_FILE_NAME_LENGTH = 180;
export const CLIENT_REQUEST_MAX_ANSWER_LENGTH = 6000;
export const CLIENT_REQUEST_MAX_ANSWER_JSON_LENGTH = 100_000;
export const CLIENT_REQUEST_MAX_FILES = Object.freeze({
  review: 0,
  contenu: 10,
  "projet-animation": 10,
  feedback: 3,
});

const IMAGE_OR_FILE_TYPES = Object.freeze([
  "application/pdf",
]);
const VIDEO_TYPES = Object.freeze([
  "video/mp4",
  "video/quicktime",
]);

function invalid(message) {
  throw new Error(`INVALID_INPUT: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value, field, { required = true, max = CLIENT_REQUEST_MAX_ANSWER_LENGTH } = {}) {
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
  const normalized = text(value, field, { max: 2048 });
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("protocol");
  } catch {
    invalid(`Invalid ${field}`);
  }
  return normalized;
}

function reviewAnswers(raw) {
  if (!isPlainObject(raw)) invalid("Invalid review answers");
  const workTypes = Array.isArray(raw.workTypes)
    ? raw.workTypes.map((value) => text(value, "work type", { max: 80 })).slice(0, 4)
    : [];
  if (!workTypes.length) invalid("Missing work types");
  if (raw.authorization !== true) invalid("Review authorization is required");
  return {
    objective: text(raw.objective, "objective", { required: false }),
    dream: text(raw.dream, "dream", { required: false }),
    workTypes,
    workLink: url(raw.workLink, "work link"),
    password: text(raw.password, "password", { required: false, max: 320 }),
    selfAssessment: text(raw.selfAssessment, "self assessment"),
    authorization: true,
  };
}

function contentAnswers(raw) {
  const values = Array.isArray(raw) ? raw : raw?.answers;
  if (!Array.isArray(values) || values.length !== 10) invalid("Invalid content answers");
  const optional = new Set([1, 8, 9]);
  return {
    answers: values.map((value, index) => text(value, `content answer ${index}`, {
      required: !optional.has(index),
    })),
  };
}

function projectAnswers(raw) {
  if (!isPlainObject(raw)) invalid("Invalid animation project answers");
  const stage = text(raw.stage, "project stage", { max: 80 });
  if (!["Une idée seulement", "Préparation commencée", "Animation commencée"].includes(stage)) {
    invalid("Invalid project stage");
  }
  return {
    idea: text(raw.idea, "project idea"),
    goal: text(raw.goal, "project goal"),
    difficulty: text(raw.difficulty, "project difficulty", { required: false }),
    references: text(raw.references, "project references", { required: false }),
    stage,
    software: text(raw.software, "software", { max: 160 }),
  };
}

function feedbackAnswers(raw) {
  if (!isPlainObject(raw)) invalid("Invalid feedback answers");
  if (!Array.isArray(raw.plans) || raw.plans.length < 1 || raw.plans.length > 3) {
    invalid("Feedback requires between 1 and 3 plans");
  }
  const plans = raw.plans.map((plan, index) => {
    if (!isPlainObject(plan)) invalid(`Invalid feedback plan ${index + 1}`);
    const name = text(plan.name, `feedback plan ${index + 1} name`, {
      max: CLIENT_REQUEST_MAX_FILE_NAME_LENGTH,
    });
    const duration = Number(plan.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 15.05) {
      invalid(`Invalid feedback plan ${index + 1} duration`);
    }
    const size = plan.size === undefined ? undefined : Number(plan.size);
    if (size !== undefined && (!Number.isSafeInteger(size) || size <= 0 || size > CLIENT_REQUEST_QUOTA_BYTES)) {
      invalid(`Invalid feedback plan ${index + 1} size`);
    }
    let mimeType;
    if (plan.mimeType !== undefined) {
      mimeType = text(plan.mimeType, `feedback plan ${index + 1} type`, { max: 120 }).toLowerCase();
      if (!VIDEO_TYPES.includes(mimeType)) invalid(`Invalid feedback plan ${index + 1} type`);
    }
    return {
      name,
      duration: Math.round(duration * 1000) / 1000,
      ...(size === undefined ? {} : { size }),
      ...(mimeType ? { mimeType } : {}),
    };
  });
  const total = plans.reduce((sum, plan) => sum + plan.duration, 0);
  if (total > 15.05) invalid("Feedback plans exceed the duration limit");
  return {
    plans,
    total: Math.round(total * 1000) / 1000,
    intent: text(raw.intent, "feedback intent"),
    blocker: text(raw.blocker, "feedback blocker", { required: false }),
    references: text(raw.references, "feedback references", { required: false }),
  };
}

export function getClientRequestOffer(offerKey) {
  return Object.prototype.hasOwnProperty.call(CLIENT_REQUEST_OFFERS, offerKey)
    ? CLIENT_REQUEST_OFFERS[offerKey]
    : null;
}

export function normalizeClientRequestAnswers(offerKey, raw) {
  if (!getClientRequestOffer(offerKey)) invalid("Unknown client request offer");
  if (offerKey === "review") return reviewAnswers(raw);
  if (offerKey === "contenu") return contentAnswers(raw);
  if (offerKey === "projet-animation") return projectAnswers(raw);
  if (offerKey === "feedback") return feedbackAnswers(raw);
  invalid("Unknown client request offer");
}

export function parseClientRequestAnswers(offerKey, answersJson) {
  if (typeof answersJson !== "string" || answersJson.length > CLIENT_REQUEST_MAX_ANSWER_JSON_LENGTH) {
    invalid("Invalid answers payload");
  }
  let parsed;
  try {
    parsed = JSON.parse(answersJson);
  } catch {
    invalid("Invalid answers payload");
  }
  return normalizeClientRequestAnswers(offerKey, parsed);
}

export function serializeClientRequestAnswers(offerKey, raw) {
  const normalized = normalizeClientRequestAnswers(offerKey, raw);
  const serialized = JSON.stringify(normalized);
  if (serialized.length > CLIENT_REQUEST_MAX_ANSWER_JSON_LENGTH) invalid("Answers payload is too large");
  return serialized;
}

export function validateClientRequestFiles(offerKey, rawAnswers, files) {
  const answers = normalizeClientRequestAnswers(offerKey, rawAnswers);
  if (offerKey !== "feedback") return true;
  if (!Array.isArray(files)) invalid("Feedback videos must be uploaded before payment");
  const unmatchedFiles = [...files];
  for (const plan of answers.plans) {
    const fileIndex = unmatchedFiles.findIndex((file) =>
      file?.name === plan.name &&
      (plan.size === undefined || file.size === plan.size) &&
      (plan.mimeType === undefined || file.mimeType === plan.mimeType),
    );
    if (fileIndex < 0) invalid("Feedback videos must be uploaded before payment");
    const [file] = unmatchedFiles.splice(fileIndex, 1);
    if (!["video/mp4", "video/quicktime"].includes(file?.mimeType)) {
      invalid("Feedback dossiers accept video files only");
    }
  }
  if (files.length === 0 || unmatchedFiles.length > 0) invalid("Feedback videos must be uploaded before payment");
  return true;
}

export function requestFilePolicy(offerKey) {
  if (!getClientRequestOffer(offerKey)) invalid("Unknown client request offer");
  if (offerKey === "review") return { maxFiles: 0, accepts: [] };
  if (offerKey === "feedback") return { maxFiles: 3, accepts: [...VIDEO_TYPES] };
  return {
    maxFiles: CLIENT_REQUEST_MAX_FILES[offerKey],
    accepts: [...IMAGE_OR_FILE_TYPES, ...VIDEO_TYPES, "image/*"],
  };
}

function isAcceptedMime(mimeType, policy) {
  return policy.accepts.some((accepted) => accepted === mimeType || (accepted.endsWith("/*") && mimeType.startsWith(accepted.slice(0, -1))));
}

export function normalizeAttachment({ offerKey, name, mimeType, size, remainingBytes }) {
  const policy = requestFilePolicy(offerKey);
  if (!policy.maxFiles) invalid("This offer does not accept attachments");
  const normalizedName = text(name, "file name", { max: CLIENT_REQUEST_MAX_FILE_NAME_LENGTH });
  if (/[[\]{}<>\0\r\n]/.test(normalizedName)) invalid("Invalid file name");
  const normalizedMimeType = text(mimeType, "file type", { max: 120 }).toLowerCase();
  if (!isAcceptedMime(normalizedMimeType, policy)) invalid("File type is not accepted");
  if (!Number.isSafeInteger(size) || size <= 0) invalid("Invalid file size");
  if (!Number.isSafeInteger(remainingBytes) || remainingBytes < 0) invalid("Invalid file quota");
  if (size > remainingBytes || size > CLIENT_REQUEST_QUOTA_BYTES) invalid("File quota exceeded");
  const isVideo = VIDEO_TYPES.includes(normalizedMimeType);
  // Convex has no per-file byte limit, so a made-up video ceiling would be
  // misleading. The per-dossier quota and provider's 2-minute POST timeout
  // remain the explicit operational boundaries for video uploads.
  if (!isVideo && size > 25 * 1024 * 1024) invalid("Non-video file is too large");
  return {
    name: normalizedName,
    mimeType: normalizedMimeType,
    size,
    isVideo,
  };
}

export function isRequestOwner(request, identity) {
  return Boolean(
    request && identity &&
    request.clerkUserId === identity.clerkUserId &&
    request.tokenIdentifier === identity.tokenIdentifier,
  );
}

export function isPaymentSuccessEvent(eventType) {
  return [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "payment_intent.succeeded",
  ].includes(eventType);
}

export function isPaymentFailureEvent(eventType) {
  return [
    "checkout.session.async_payment_failed",
    "payment_intent.payment_failed",
  ].includes(eventType);
}

export function classifyChargeRefund({ amountTotal, amountRefunded, refunded }, expectedAmount) {
  if (!Number.isSafeInteger(amountTotal) || amountTotal <= 0 ||
      !Number.isSafeInteger(amountRefunded) || amountRefunded <= 0 || amountRefunded > amountTotal ||
      typeof refunded !== "boolean" ||
      (expectedAmount !== undefined && amountTotal !== expectedAmount)) {
    throw new Error("PAYMENT_MISMATCH: Invalid refunded charge amount");
  }
  const full = amountRefunded === amountTotal;
  if (refunded !== full) throw new Error("PAYMENT_MISMATCH: Conflicting refunded charge state");
  return full ? "full" : "partial";
}
