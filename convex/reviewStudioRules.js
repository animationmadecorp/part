// Framework-free validation shared by the review mutations and their tests.
// Annotation coordinates are normalized to the video viewport so a published
// review remains independent from the browser size that created it.

export const REVIEW_MAX_SECONDS = 15.05;
export const REVIEW_MAX_JSON_LENGTH = 300_000;
export const REVIEW_FPS = Object.freeze([24, 25, 30, 48, 50, 60]);
export const REVIEW_COLORS = Object.freeze([
  "#FF4D4D",
  "#ECAB3F",
  "#B6A8E6",
  "#EC8FB6",
  "#FFFFFF",
]);

function invalid(message) {
  throw new Error(`INVALID_INPUT: ${message}`);
}

function finiteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) invalid(`Invalid ${field}`);
  return number;
}

function boundedNumber(value, field, min, max) {
  const number = finiteNumber(value, field);
  if (number < min || number > max) invalid(`Invalid ${field}`);
  return number;
}

function integer(value, field, min, max) {
  const number = finiteNumber(value, field);
  if (!Number.isSafeInteger(number) || number < min || number > max) invalid(`Invalid ${field}`);
  return number;
}

function shortText(value, field, max) {
  if (typeof value !== "string" || value.length > max) invalid(`Invalid ${field}`);
  return value;
}

function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`Invalid ${field}`);
  return value;
}

function array(value, field, max) {
  if (!Array.isArray(value) || value.length > max) invalid(`Invalid ${field}`);
  return value;
}

function point(value, field) {
  if (!Array.isArray(value) || value.length !== 2) invalid(`Invalid ${field}`);
  return [
    boundedNumber(value[0], `${field} x`, 0, 1),
    boundedNumber(value[1], `${field} y`, 0, 1),
  ];
}

function frameBounds(duration, fps) {
  return Math.max(0, Math.ceil(Math.max(0, duration) * fps) + 1);
}

function frameValue(value, field, maxFrame) {
  return integer(value, field, 0, maxFrame);
}

export function normalizeReviewPayload({
  strokes,
  textBoxes,
  comments,
  fps,
  duration,
  videoWidth,
  videoHeight,
}) {
  const normalizedFps = REVIEW_FPS.includes(Number(fps)) ? Number(fps) : invalid("Invalid fps");
  const normalizedDuration = boundedNumber(duration, "duration", 0, REVIEW_MAX_SECONDS);
  const maxFrame = frameBounds(normalizedDuration, normalizedFps);

  const normalizedStrokes = array(strokes, "strokes", 2000).map((stroke, index) => {
    const item = object(stroke, `stroke ${index + 1}`);
    const start = frameValue(item.frame, `stroke ${index + 1} frame`, maxFrame);
    const end = item.end === undefined ? start : frameValue(item.end, `stroke ${index + 1} end`, maxFrame);
    if (end < start) invalid(`Invalid stroke ${index + 1} range`);
    if (typeof item.color !== "string" || !REVIEW_COLORS.includes(item.color.toUpperCase())) {
      invalid(`Invalid stroke ${index + 1} color`);
    }
    return {
      frame: start,
      end,
      color: item.color.toUpperCase(),
      size: boundedNumber(item.size, `stroke ${index + 1} size`, 1, 60),
      pts: array(item.pts, `stroke ${index + 1} points`, 400)
        .map((value, pointIndex) => point(value, `stroke ${index + 1} point ${pointIndex + 1}`)),
    };
  });

  const normalizedTextBoxes = array(textBoxes, "text boxes", 200).map((textBox, index) => {
    const item = object(textBox, `text box ${index + 1}`);
    const start = frameValue(item.frame, `text box ${index + 1} frame`, maxFrame);
    const end = item.end === undefined ? start : frameValue(item.end, `text box ${index + 1} end`, maxFrame);
    if (end < start) invalid(`Invalid text box ${index + 1} range`);
    if (typeof item.color !== "string" || !REVIEW_COLORS.includes(item.color.toUpperCase())) {
      invalid(`Invalid text box ${index + 1} color`);
    }
    return {
      id: shortText(item.id, `text box ${index + 1} id`, 120),
      frame: start,
      end,
      x: boundedNumber(item.x, `text box ${index + 1} x`, 0, 1),
      y: boundedNumber(item.y, `text box ${index + 1} y`, 0, 1),
      text: shortText(item.text, `text box ${index + 1} text`, 240),
      color: item.color.toUpperCase(),
      size: boundedNumber(item.size, `text box ${index + 1} size`, 4, 240),
    };
  });

  const normalizedComments = array(comments, "comments", 500).map((comment, index) => {
    const item = object(comment, `comment ${index + 1}`);
    return {
      id: shortText(item.id, `comment ${index + 1} id`, 120),
      time: boundedNumber(item.time, `comment ${index + 1} time`, 0, normalizedDuration),
      text: shortText(item.text, `comment ${index + 1} text`, 1000),
    };
  });

  const normalizedWidth = videoWidth === undefined || videoWidth === null
    ? undefined
    : integer(videoWidth, "video width", 1, 16384);
  const normalizedHeight = videoHeight === undefined || videoHeight === null
    ? undefined
    : integer(videoHeight, "video height", 1, 16384);
  if ((normalizedWidth === undefined) !== (normalizedHeight === undefined)) {
    invalid("Video dimensions must be provided together");
  }

  const payload = {
    strokes: normalizedStrokes,
    textBoxes: normalizedTextBoxes,
    comments: normalizedComments,
    fps: normalizedFps,
    duration: normalizedDuration,
    ...(normalizedWidth === undefined ? {} : { videoWidth: normalizedWidth, videoHeight: normalizedHeight }),
  };
  const json = {
    strokesJson: JSON.stringify(normalizedStrokes),
    textBoxesJson: JSON.stringify(normalizedTextBoxes),
    commentsJson: JSON.stringify(normalizedComments),
  };
  if (Object.values(json).some((value) => value.length > REVIEW_MAX_JSON_LENGTH)) {
    invalid("Review annotations are too large");
  }
  return { ...payload, ...json };
}

export function parseReviewArray(value, field) {
  if (typeof value !== "string" || value.length > REVIEW_MAX_JSON_LENGTH) invalid(`Invalid ${field}`);
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    invalid(`Invalid ${field}`);
  }
  if (!Array.isArray(parsed)) invalid(`Invalid ${field}`);
  return parsed;
}

