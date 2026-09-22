"use client";

import { useEffect, useRef } from "react";

function displayValue(value, fallback = "Non renseigné") {
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  if (typeof value === "string") return value.trim() || fallback;
  return value ?? fallback;
}

export default function PrePaymentRecap({
  title = "Récapitulatif",
  summaryTitle = "Tes réponses",
  items,
  files = [],
  filesTitle = "Fichiers sélectionnés",
  offer,
  onEdit,
  paymentText,
  onPayment,
  paymentDisabled = false,
  paymentError = "",
  headingRef,
}) {
  const localHeading = useRef(null);
  const targetHeading = headingRef ?? localHeading;
  useEffect(() => {
    targetHeading.current?.focus();
  }, [targetHeading]);

  return <>
    <p className="am-eyebrow am-project-eyebrow">Avant le paiement</p>
    <h1 ref={targetHeading} tabIndex={-1} className="am-project-title am-recap-title">{title}</h1>
    <div className="am-prepayment-recap-layout">
      <section className="am-prepayment-recap-summary" aria-labelledby="recap-summary-heading">
        <h2 id="recap-summary-heading">{summaryTitle}</h2>
        <dl>
          {items.map(({ label, value, fallback }) => <div key={label}>
            <dt>{label}</dt>
            <dd>{displayValue(value, fallback)}</dd>
          </div>)}
        </dl>
        {files !== null && <div className="am-prepayment-recap-files">
          <h2>{filesTitle}</h2>
          {files.length > 0
            ? <ul>{files.map((file, index) => <li key={`${file.name}-${file.lastModified ?? index}-${file.size ?? index}`}>{file.name}</li>)}</ul>
            : <p>Aucun fichier sélectionné.</p>}
        </div>}
      </section>
      <aside className="am-prepayment-recap-offer" aria-labelledby="recap-offer-heading">
        <p className="am-prepayment-recap-label">{offer.format}</p>
        <h2 id="recap-offer-heading">{offer.name}</h2>
        <p className="am-prepayment-recap-price">{offer.priceLabel}</p>
        {offer.launchPriceEnd && <p><em>Tarif de lancement valable jusqu’au {offer.launchPriceEnd}.</em></p>}
        {offer.details.map((detail) => <p key={detail}>{detail}</p>)}
        <button className="am-button" type="button" disabled={paymentDisabled} onClick={onPayment}>
          {paymentDisabled ? "Préparation du paiement…" : paymentText}
        </button>
        {paymentError ? <p className="am-form-error" role="alert">{paymentError}</p> : null}
        <button className="am-secondary-button am-prepayment-edit-button" type="button" onClick={onEdit}>Modifier</button>
      </aside>
    </div>
  </>;
}
