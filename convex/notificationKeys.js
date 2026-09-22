export function notificationIdempotencyKey(notificationId, kind, scheduleRevision = 0) {
  return kind === "reminder"
    ? `notification:${notificationId}:reminder:${scheduleRevision || 0}`
    : `notification:${notificationId}`;
}
