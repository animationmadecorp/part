"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { canReuseUnuploadedReservation, matchesUploadSession, preferNewestUpload } from "./deliverySession.mjs";

export default function PdfDelivery({ request = null, onDelivered }) {
  const input = useRef(null);
  const [document, setDocument] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);
  const [uploadSession, setUploadSession] = useState(null);
  const [documentSessionKey, setDocumentSessionKey] = useState(null);
  const deliveryUpload = useQuery("adminRequests:getAdminDeliveryUpload", request ? { requestId: request.id } : "skip");
  const prepareDelivery = useMutation("adminRequests:prepareDelivery");
  const recordDeliveryStorage = useMutation("adminRequests:recordDeliveryStorage");
  const finalizeDelivery = useMutation("adminRequests:finalizeDelivery");

  useEffect(() => () => { if (document) URL.revokeObjectURL(document.url); }, [document]);

  const currentUpload = preferNewestUpload(uploadSession, deliveryUpload);
  const isReady = ready || Boolean(currentUpload?.status === "finalized" && currentUpload.storageId);
  const resumableUpload = Boolean(currentUpload?.status === "pending" && currentUpload.storageId);

  async function selectPdf(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setChecking(true);
    try {
      const signature = await file.slice(0, 5).text();
      if (!/\.pdf$/i.test(file.name) || signature !== "%PDF-") {
        setError("Choisis un document PDF valide. Aucun fichier n’a été enregistré.");
        return;
      }
      if (document) URL.revokeObjectURL(document.url);
      setDocument({ file, name: file.name, url: URL.createObjectURL(file) });
      const sameReservation = canReuseUnuploadedReservation(currentUpload, file);
      setUploadSession(sameReservation ? currentUpload : false);
      setDocumentSessionKey(sameReservation ? currentUpload.uploadKey : null);
      setReady(false);
    } catch { setError("Impossible de lire ce fichier. Réessaie avec un autre PDF."); }
    finally { setChecking(false); }
  }

  async function confirmReady() {
    if (!request || checking || isReady || (!document?.file && !resumableUpload)) return;
    setError("");
    setChecking(true);
    try {
      let session = currentUpload;
      const hasMatchingSession = matchesUploadSession(session, document?.file, documentSessionKey);
      if (!hasMatchingSession) {
        if (!document?.file) throw new Error("La réservation du PDF a expiré. Choisis à nouveau le fichier.");
        const prepared = await prepareDelivery({
          requestId: request.id,
          name: document.name,
          mimeType: "application/pdf",
          size: document.file.size,
        });
        session = {
          ...prepared,
          status: "pending",
          name: document.name,
          expectedSize: document.file.size,
        };
        setUploadSession(session);
        setDocumentSessionKey(session.uploadKey);
      }
      let storageId = session.storageId;
      if (!storageId) {
        const uploadResponse = await fetch(session.uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: document.file,
        });
        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || typeof uploadResult.storageId !== "string") {
          throw new Error("Le stockage du PDF n’a pas confirmé l’upload.");
        }
        storageId = uploadResult.storageId;
        session = { ...session, storageId };
        setUploadSession(session);
        setDocumentSessionKey(session.uploadKey);
        await recordDeliveryStorage({ requestId: request.id, uploadKey: session.uploadKey, storageId });
      }
      const finalized = await finalizeDelivery({ requestId: request.id, uploadKey: session.uploadKey, storageId });
      if (!finalized?.ok) throw new Error(finalized?.error || "La livraison n’a pas été enregistrée.");
      setReady(true);
      setUploadSession({ ...session, status: "finalized", storageId });
      onDelivered?.(finalized);
    } catch (deliveryError) {
      setError(deliveryError instanceof Error ? deliveryError.message : "La livraison n’a pas été enregistrée.");
    } finally { setChecking(false); }
  }

  return <section className="am-pdf-delivery" aria-labelledby="delivery-title">
    <header><p className="am-eyebrow">Retour à remettre</p><h2 id="delivery-title">Ton document <em>personnalisé.</em></h2>
      {!request && <p>Sélectionne un dossier pour préparer son retour.</p>}
    </header>
    <div className="am-pdf-delivery-grid"><div>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={selectPdf} disabled={!request || checking || isReady}/>
      <button type="button" className="am-secondary-button am-pdf-choose" disabled={!request || checking || isReady} onClick={() => input.current?.click()}>{checking ? "Enregistrement…" : document ? "Remplacer le PDF" : "Ajouter le PDF"}</button>
      {document && <div className="am-pdf-file"><span>{document.name}</span><button type="button" disabled={checking || isReady} onClick={() => { URL.revokeObjectURL(document.url); setDocument(null); setReady(false); }}>Retirer</button></div>}
      {resumableUpload && !document && <p className="am-pdf-resume">Un PDF déjà téléversé attend sa finalisation. Reprends l’enregistrement sans le réimporter.</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="am-button am-pdf-send" disabled={!request || (!document?.file && !resumableUpload) || checking || isReady} onClick={confirmReady}>{isReady ? "Retour enregistré dans Convex" : resumableUpload && !document ? "Finaliser le retour" : "Enregistrer le retour"}</button>
      {isReady && <p className="am-ready-confirmation" role="status">Le PDF est stocké côté serveur et l’événement de livraison est audité. Aucun message non persisté n’est proposé.</p>}
    </div><div className="am-pdf-preview">
      {document ? <><iframe src={document.url} title={`Aperçu de ${document.name}`}/><a href={document.url} target="_blank" rel="noreferrer">Ouvrir le PDF en grand</a></> : <div><h3>Aperçu du PDF</h3><p>Ton document apparaîtra ici pour une dernière vérification.</p></div>}
    </div></div>
  </section>;
}
