export function preferNewestUpload(localUpload, remoteUpload) {
  if (localUpload === false) return null;
  if (!localUpload) return remoteUpload;
  if (!remoteUpload) return localUpload;
  if (remoteUpload.status === "finalized" && localUpload.status !== "finalized") return remoteUpload;
  if (localUpload.storageId && !remoteUpload.storageId) return localUpload;
  return (remoteUpload.updatedAt || 0) > (localUpload.updatedAt || 0) ? remoteUpload : localUpload;
}

export function canReuseUnuploadedReservation(upload, file, now = Date.now()) {
  return Boolean(
    upload?.status === "pending" &&
    upload.expiresAt > now &&
    !upload.storageId &&
    upload.name === file?.name &&
    upload.expectedSize === file?.size,
  );
}

export function matchesUploadSession(upload, documentFile, documentSessionKey, now = Date.now()) {
  return Boolean(
    upload?.status === "pending" &&
    upload.expiresAt > now &&
    (!documentFile || upload.uploadKey === documentSessionKey),
  );
}
