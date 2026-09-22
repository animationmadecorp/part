"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";

const providersConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CONVEX_URL,
);

const TERMINAL_STATUSES = new Set(["paid", "refunded", "cancelled"]);

function isFeedbackCheckoutLocked(request) {
  return Boolean(
    request?.offerKey === "feedback" &&
    !TERMINAL_STATUSES.has(request.status) &&
    (request.checkoutPending || request.checkoutSessionId),
  );
}

function randomKey(prefix) {
  const id = globalThis.crypto?.randomUUID?.();
  return `${prefix}:${id || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function inferMimeType(file) {
  if (typeof file?.type === "string" && file.type) return file.type.toLowerCase();
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  return {
    pdf: "application/pdf",
    mp4: "video/mp4",
    mov: "video/quicktime",
  }[extension] || "application/octet-stream";
}

function sameFile(left, right) {
  return Boolean(
    left && right &&
    left.name === right.name &&
    Number(left.size) === Number(right.size) &&
    String(left.mimeType || left.type || "") === String(right.mimeType || right.type || ""),
  );
}

function feedbackPlanMatchesFile(plan, file) {
  if (!plan || !file || plan.name !== file.name) return false;
  if (plan.size !== undefined && Number(plan.size) !== Number(file.size)) return false;
  if (plan.mimeType !== undefined && String(plan.mimeType).toLowerCase() !== String(file.mimeType || file.type || "").toLowerCase()) return false;
  return true;
}

function pendingUploadFingerprint(file, mimeType) {
  return `${file.name}\u0000${file.size}\u0000${mimeType}`;
}

function readPendingUploads(storageKey) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writePendingUploads(storageKey, value) {
  try {
    if (Object.keys(value).length) window.localStorage.setItem(storageKey, JSON.stringify(value));
    else window.localStorage.removeItem(storageKey);
  } catch { /* Server-side reservations remain authoritative. */ }
}

function readableError(error) {
  const message = error instanceof Error ? error.message : "";
  if (/UNAUTHENTICATED|Connecte-toi|unauthenticated/i.test(message)) return "Connecte-toi pour enregistrer ton dossier et accéder au paiement.";
  if (/configuration_required|unavailable|configuration/i.test(message)) return "La connexion sécurisée n’est pas disponible dans cet environnement.";
  if (/FILE_QUOTA|quota/i.test(message)) return "La limite de pièces jointes de ce dossier est atteinte.";
  if (/File type|file type|type de fichier/i.test(message)) return "Ce type de fichier n’est pas accepté. Vérifie le format indiqué sous le bouton.";
  if (/too large|size|taille/i.test(message)) return "Ce fichier est trop volumineux pour ce dossier.";
  if (/Stripe test configuration/i.test(message)) return "Le paiement Stripe test n’est pas encore configuré dans cet environnement.";
  if (/ALREADY_PAID|NEW_DRAFT_REQUIRED/i.test(message)) return "Ce dossier est déjà fermé. Un nouveau dossier sera créé pour cette commande.";
  if (/INVALID_STATE|checkout_already_submitted/i.test(message)) return "Ce paiement est déjà en cours. Vérifie la page de confirmation avant de réessayer.";
  if (/INVALID_INPUT|Missing|answers/i.test(message)) return "Complète les éléments obligatoires avant de continuer.";
  return "Le dossier n’a pas pu être enregistré. Tu peux réessayer sans perdre tes réponses.";
}

function isNewDraftRequired(error) {
  return /NEW_DRAFT_REQUIRED/.test(error instanceof Error ? error.message : "");
}

function useConfiguredCheckout({ offerKey, draftStorageKey: draftStorageKeyBase, requestId: initialRequestId = null }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { user } = useUser();
  const userId = user?.id || null;
  const createDraft = useMutation("clientRequests:createDraft");
  const saveDraft = useMutation("clientRequests:saveDraft");
  const prepareAttachment = useMutation("clientRequests:prepareAttachment");
  const recordAttachmentStorage = useMutation("clientRequests:recordAttachmentStorage");
  const finalizeAttachment = useMutation("clientRequests:finalizeAttachment");
  const abandonAttachmentUpload = useMutation("clientRequests:abandonAttachmentUpload");
  const removeAttachment = useMutation("clientRequests:removeAttachment");
  const [initialRequestContext, setInitialRequestContext] = useState(() => ({
    requestId: initialRequestId,
    userId,
  }));
  const [createdRequest, setCreatedRequest] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const initialRequestIsOwned = Boolean(
    initialRequestId && (
      initialRequestContext.requestId !== initialRequestId ||
      initialRequestContext.userId === null ||
      initialRequestContext.userId === userId
    ),
  );
  const createdRequestIsCurrent = Boolean(
    createdRequest &&
    createdRequest.userId === userId &&
    createdRequest.sourceRequestId === (initialRequestId || null),
  );
  const activeRequestId = createdRequestIsCurrent
    ? createdRequest.id
    : (initialRequestIsOwned ? initialRequestId : null);
  const localDraftKey = `${draftStorageKeyBase}:${userId || "signed-out"}:v2`;
  const identityContextReady = initialRequestContext.requestId === initialRequestId && initialRequestContext.userId === userId;
  const queriedServerRequest = useQuery(
    "clientRequests:getMyRequest",
    activeRequestId && isAuthenticated ? { requestId: activeRequestId } : "skip",
  );
  const serverLoading = Boolean(!identityContextReady || authLoading || (activeRequestId && isAuthenticated && queriedServerRequest === undefined));
  const serverRequest = activeRequestId && queriedServerRequest?.id === activeRequestId
    ? queriedServerRequest
    : null;
  const [removedFileIds, setRemovedFileIds] = useState(() => new Set());
  const storedFiles = (serverRequest?.files || []).filter((file) => !removedFileIds.has(file.id));

  /* eslint-disable react-hooks/set-state-in-effect -- synchronize the URL dossier with the authenticated account. */
  useEffect(() => {
    setInitialRequestContext({ requestId: initialRequestId, userId });
    // Remove the pre-authentication key used by the old questionnaires. It
    // was intentionally shared by all accounts on one browser.
    try { window.localStorage.removeItem(draftStorageKeyBase); } catch { /* Browser storage can be unavailable. */ }
  }, [draftStorageKeyBase, initialRequestId, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function createOrReuseDraft() {
    const draftKeyName = `animation-made:client-request:${userId}:${offerKey}:draft-key:v2`;
    let draftKey;
    try { draftKey = window.localStorage.getItem(draftKeyName); } catch { /* Continue with an in-memory key. */ }
    if (!draftKey) {
      draftKey = randomKey(`draft:${offerKey}`);
      try { window.localStorage.setItem(draftKeyName, draftKey); } catch { /* The server remains authoritative. */ }
    }

    try {
      return { draft: await createDraft({ draftKey, offerKey }), draftKeyName };
    } catch (failure) {
      if (!isNewDraftRequired(failure)) throw failure;
      // A paid/refunded/cancelled dossier cannot be mutated. Rotate both
      // client keys so a second order is a genuinely new server record.
      try {
        window.localStorage.removeItem(draftKeyName);
        window.localStorage.removeItem(localDraftKey);
      } catch { /* The new server draft is still safe to create. */ }
      const freshDraftKey = randomKey(`draft:${offerKey}`);
      try { window.localStorage.setItem(draftKeyName, freshDraftKey); } catch { /* Continue without persistent draft-key storage. */ }
      return { draft: await createDraft({ draftKey: freshDraftKey, offerKey }), draftKeyName };
    }
  }

  async function removeStoredFile(fileId) {
    const requestId = activeRequestId;
    const storedFile = storedFiles.find((file) => file.id === fileId);
    if (!requestId || !fileId) return false;
    try {
      await removeAttachment({ requestId, fileId });
      setRemovedFileIds((current) => new Set([...current, fileId]));
      setError("");
      return storedFile || true;
    } catch (failure) {
      setError(readableError(failure));
      return false;
    }
  }

  async function startCheckout({ answers, files = [] }) {
    if (isBusy) return;
    setError("");
    if (authLoading) {
      setError("La connexion sécurisée est encore en cours de chargement. Réessaie dans un instant.");
      return;
    }
    if (!isAuthenticated || !userId) {
      setError("Connecte-toi pour enregistrer ton dossier et accéder au paiement.");
      return;
    }
    if (serverLoading) {
      setError("Le dossier est encore en cours de chargement. Réessaie dans un instant.");
      return;
    }
    setIsBusy(true);
    try {
      let requestId = activeRequestId;
      let draftKeyName = `animation-made:client-request:${userId}:${offerKey}:draft-key:v2`;
      let draft = null;
      let checkoutLocked = isFeedbackCheckoutLocked(serverRequest);

      if (!checkoutLocked && (!requestId || (serverRequest && TERMINAL_STATUSES.has(serverRequest.status)))) {
        setCreatedRequest(null);
        const created = await createOrReuseDraft();
        draft = created.draft;
        draftKeyName = created.draftKeyName;
        requestId = draft?.id;
        // The idempotent draft key can resolve to an older feedback dossier
        // after a reload. Re-evaluate its lock before touching the submitted
        // answers or files: a failed Stripe attempt must never let a new
        // browser draft overwrite or mix with that dossier.
        checkoutLocked = isFeedbackCheckoutLocked(draft);
        if (requestId) {
          setCreatedRequest({
            id: requestId,
            userId,
            sourceRequestId: initialRequestId || null,
          });
        }
      }
      if (!requestId) throw new Error("request_missing");
      if (!checkoutLocked) {
        if (offerKey === "feedback" && Array.isArray(answers?.plans)) {
          const knownStoredFiles = (serverRequest?.id === requestId && Array.isArray(storedFiles))
            ? storedFiles
            : (Array.isArray(draft?.files) ? draft.files : []);
          const unmatchedStoredFiles = [...knownStoredFiles];
          for (const plan of answers.plans) {
            const index = unmatchedStoredFiles.findIndex((file) => feedbackPlanMatchesFile(plan, file));
            if (index >= 0) unmatchedStoredFiles.splice(index, 1);
          }
          for (const staleFile of unmatchedStoredFiles) {
            try {
              await removeAttachment({ requestId, fileId: staleFile.id });
              setRemovedFileIds((current) => new Set([...current, staleFile.id]));
            } catch {
              throw new Error("attachment_reconcile_failed");
            }
          }
        }
        await saveDraft({ requestId, answersJson: JSON.stringify(answers) });

        const persistedFiles = (serverRequest?.id === requestId && Array.isArray(storedFiles))
        ? storedFiles
        : (Array.isArray(draft?.files) ? draft.files : []);
        const completedFiles = [...persistedFiles];
        const pendingStorageKey = `${localDraftKey}:uploads:${requestId}`;
        const pendingUploads = readPendingUploads(pendingStorageKey);
        const abandonPendingUpload = async (uploadKey, storageId) => {
        try {
          await abandonAttachmentUpload({ requestId, uploadKey, ...(storageId ? { storageId } : {}) });
          return true;
        } catch {
          return false;
        }
        };
        const uploadWithKey = async (file, mimeType, uploadKey) => {
        let upload;
        try {
          upload = await prepareAttachment({
            requestId,
            uploadKey,
            name: file.name,
            mimeType,
            size: file.size,
            kind: mimeType.startsWith("video/") ? "video" : "attachment",
          });
        } catch (failure) {
          if (/RETRY_REQUIRED/.test(failure instanceof Error ? failure.message : "")) failure.uploadReservationPrepared = true;
          throw failure;
        }
        try {
          const response = await fetch(upload.uploadUrl, {
            method: "POST",
            headers: { "Content-Type": mimeType },
            body: file,
          });
          const uploaded = await response.json().catch(() => null);
          if (!response.ok || !uploaded?.storageId) throw new Error("attachment_upload_failed");
          return uploaded.storageId;
        } catch (failure) {
          failure.uploadReservationPrepared = true;
          throw failure;
        }
        };
        for (const file of Array.isArray(files) ? files : []) {
        if (!file || typeof file !== "object") continue;
        const mimeType = inferMimeType(file);
        if (completedFiles.some((storedFile) => sameFile(storedFile, {
          name: file.name,
          size: file.size,
          mimeType,
        }))) continue;
        const fingerprint = pendingUploadFingerprint(file, mimeType);
        let pending = pendingUploads[fingerprint];
        if (!pending || typeof pending !== "object" || typeof pending.uploadKey !== "string") {
          pending = { uploadKey: randomKey("upload") };
          pendingUploads[fingerprint] = pending;
          writePendingUploads(pendingStorageKey, pendingUploads);
        }
        if (pending.abandonPending) {
          if (!(await abandonPendingUpload(pending.uploadKey, pending.storageId))) throw new Error("attachment_cleanup_pending");
          delete pendingUploads[fingerprint];
          pending = { uploadKey: randomKey("upload") };
          pendingUploads[fingerprint] = pending;
          writePendingUploads(pendingStorageKey, pendingUploads);
        }
        let storageId = pending.storageId;
        if (!storageId) {
          try {
            storageId = await uploadWithKey(file, mimeType, pending.uploadKey);
          } catch (failure) {
            const retryRequired = /RETRY_REQUIRED/.test(failure instanceof Error ? failure.message : "");
            if (!retryRequired && failure.uploadReservationPrepared !== true) throw failure;
            if (!(await abandonPendingUpload(pending.uploadKey, pending.storageId))) {
              pending.abandonPending = true;
              writePendingUploads(pendingStorageKey, pendingUploads);
              throw failure;
            }
            delete pendingUploads[fingerprint];
            pending = { uploadKey: randomKey("upload") };
            pendingUploads[fingerprint] = pending;
            writePendingUploads(pendingStorageKey, pendingUploads);
            try {
              storageId = await uploadWithKey(file, mimeType, pending.uploadKey);
            } catch (retryFailure) {
              if (retryFailure.uploadReservationPrepared === true) {
                if (!(await abandonPendingUpload(pending.uploadKey, pending.storageId))) {
                  pending.abandonPending = true;
                  writePendingUploads(pendingStorageKey, pendingUploads);
                } else {
                  delete pendingUploads[fingerprint];
                  writePendingUploads(pendingStorageKey, pendingUploads);
                }
              } else {
                writePendingUploads(pendingStorageKey, pendingUploads);
              }
              throw retryFailure;
            }
          }
          pending.storageId = storageId;
          writePendingUploads(pendingStorageKey, pendingUploads);
        }
        try {
          await recordAttachmentStorage({ requestId, uploadKey: pending.uploadKey, storageId });
        } catch (failure) {
          if (!(await abandonPendingUpload(pending.uploadKey, storageId))) {
            pending.abandonPending = true;
            writePendingUploads(pendingStorageKey, pendingUploads);
          } else {
            delete pendingUploads[fingerprint];
            writePendingUploads(pendingStorageKey, pendingUploads);
          }
          throw failure;
        }
        let finalized;
        try {
          finalized = await finalizeAttachment({ requestId, uploadKey: pending.uploadKey, storageId });
        } catch (failure) {
          if (!/RETRY_REQUIRED/.test(failure instanceof Error ? failure.message : "")) throw failure;
          if (!(await abandonPendingUpload(pending.uploadKey, pending.storageId))) {
            pending.abandonPending = true;
            writePendingUploads(pendingStorageKey, pendingUploads);
            throw failure;
          }
          delete pendingUploads[fingerprint];
          pending = { uploadKey: randomKey("upload") };
          pendingUploads[fingerprint] = pending;
          writePendingUploads(pendingStorageKey, pendingUploads);
          try {
            storageId = await uploadWithKey(file, mimeType, pending.uploadKey);
          } catch (retryFailure) {
            if (retryFailure.uploadReservationPrepared === true) {
              if (!(await abandonPendingUpload(pending.uploadKey, pending.storageId))) pending.abandonPending = true;
              if (pending.abandonPending) writePendingUploads(pendingStorageKey, pendingUploads);
              else {
                delete pendingUploads[fingerprint];
                writePendingUploads(pendingStorageKey, pendingUploads);
              }
            } else {
              writePendingUploads(pendingStorageKey, pendingUploads);
            }
            throw retryFailure;
          }
          pending.storageId = storageId;
          writePendingUploads(pendingStorageKey, pendingUploads);
          try {
            await recordAttachmentStorage({ requestId, uploadKey: pending.uploadKey, storageId });
          } catch (failure) {
            if (!(await abandonPendingUpload(pending.uploadKey, storageId))) {
              pending.abandonPending = true;
              writePendingUploads(pendingStorageKey, pendingUploads);
            } else {
              delete pendingUploads[fingerprint];
              writePendingUploads(pendingStorageKey, pendingUploads);
            }
            throw failure;
          }
          finalized = await finalizeAttachment({ requestId, uploadKey: pending.uploadKey, storageId });
        }
        if (finalized?.ok === false) {
          if (!(await abandonPendingUpload(pending.uploadKey, pending.storageId || storageId))) {
            pending.abandonPending = true;
            writePendingUploads(pendingStorageKey, pendingUploads);
          } else {
            delete pendingUploads[fingerprint];
            writePendingUploads(pendingStorageKey, pendingUploads);
          }
          throw new Error(finalized.error || "attachment_rejected");
        }
        delete pendingUploads[fingerprint];
        writePendingUploads(pendingStorageKey, pendingUploads);
        if (finalized) completedFiles.push(finalized);
        }
      }

      const checkoutResponse = await fetch("/api/stripe/client-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const checkout = await checkoutResponse.json().catch(() => null);
      if (!checkoutResponse.ok || !checkout?.url) throw new Error(checkout?.error || "stripe_unavailable");
      try {
        window.localStorage.removeItem(localDraftKey);
        window.localStorage.removeItem(draftKeyName);
      } catch { /* The saved Convex dossier remains available on the confirmation page. */ }
      window.location.assign(checkout.url);
    } catch (failure) {
      setError(readableError(failure));
    } finally {
      setIsBusy(false);
    }
  }

  return {
    startCheckout,
    removeStoredFile,
    isBusy,
    error,
    configured: true,
    userId,
    localDraftKey,
    requestId: activeRequestId,
    serverRequest,
    serverLoading,
    storedFiles,
  };
}

export function useClientRequestCheckout(options) {
  // AuthProviders omits Convex when either public configuration value is
  // absent. Keep public questionnaire pages renderable in that state.
  if (!providersConfigured) {
    const base = options?.draftStorageKey || "animation-made:client-request";
    return {
      startCheckout: async () => {},
      removeStoredFile: async () => false,
      isBusy: false,
      error: "La connexion sécurisée n’est pas disponible dans cet environnement.",
      configured: false,
      userId: null,
      localDraftKey: `${base}:signed-out:v2`,
      requestId: options?.requestId || null,
      serverRequest: null,
      serverLoading: false,
      storedFiles: [],
    };
  }
  // The branch is a module-level configuration invariant: the provider is
  // mounted exactly when this hook reaches the Convex/Clerk hooks.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useConfiguredCheckout(options);
}
