"use client";

import { useEffect, useId, useState } from "react";

function PriceRow({ variantKey, label, description, price, onSave }) {
  const inputId = `${useId()}-${variantKey.replaceAll(":", "-")}`;
  const [amount, setAmount] = useState(() => (price.priceCents / 100).toFixed(2));
  const [baseVersion, setBaseVersion] = useState(price.version);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const draftCents = Math.round(Number(amount.replace(",", ".")) * 100);
  const valid = Number.isSafeInteger(draftCents) && draftCents > 0 && draftCents <= 100_000_000;
  const changed = valid && draftCents !== price.priceCents;
  const stale = baseVersion !== price.version;

  useEffect(() => {
    if (baseVersion === price.version) return;
    if (amount === (price.priceCents / 100).toFixed(2)) {
      // Synchronize an untouched row after another admin saves a new version.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBaseVersion(price.version);
    }
  }, [amount, baseVersion, price.priceCents, price.version]);

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    if (!valid) {
      setNotice("Saisis un montant positif avec deux décimales maximum.");
      return;
    }
    if (stale) {
      setNotice("Ce tarif a changé ailleurs. Recharge sa valeur avant d’enregistrer.");
      return;
    }
    if (!changed) return;
    setBusy(true);
    try {
      const saved = await onSave({ variantKey, priceCents: draftCents, expectedVersion: baseVersion });
      setBaseVersion(saved.version);
      setAmount((saved.priceCents / 100).toFixed(2));
      setNotice("Tarif enregistré.");
    } catch (error) {
      setNotice(/PRICE_VERSION_CONFLICT/.test(error?.message || "")
        ? "Ce tarif a changé ailleurs. Recharge sa valeur avant d’enregistrer."
        : "L’enregistrement a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function restoreCurrent() {
    setAmount((price.priceCents / 100).toFixed(2));
    setBaseVersion(price.version);
    setNotice("");
  }

  return (
    <form className="am-pricing-row" onSubmit={submit}>
      <div className="am-pricing-row-copy">
        <h3>{label}</h3>
        {description ? <p>{description}</p> : null}
        <small>Tarif actuel : {price.priceLabel}</small>
      </div>
      <div className="am-pricing-row-controls">
        <label htmlFor={inputId}>Nouveau tarif en euros</label>
        <div className="am-pricing-input-wrap">
          <input
            id={inputId}
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => { setAmount(event.target.value); setNotice(""); }}
            disabled={busy}
            required
          />
          <span aria-hidden="true">€</span>
        </div>
        <div className="am-pricing-row-actions">
          {stale ? <button type="button" className="pill btn-ghost text-sm" onClick={restoreCurrent}>Charger le tarif actuel</button> : null}
          <button type="submit" className="pill btn-primary text-sm" disabled={!changed || stale || busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
        <p className="am-pricing-row-notice" role={notice && notice !== "Tarif enregistré." ? "alert" : "status"}>{notice}</p>
      </div>
    </form>
  );
}

export default function PriceEditor({ catalog, groups, onSave }) {
  return <div className="am-pricing-groups">
    {groups.map((group) => <section className="am-pricing-group" key={group.title} aria-label={group.title}>
      <div className="am-pricing-group-heading">
        <h2>{group.title}</h2>
        {group.description ? <p>{group.description}</p> : null}
      </div>
      {group.items.map((item) => {
        const price = catalog.prices[item.variantKey];
        return price ? <PriceRow key={item.variantKey} {...item} price={price} onSave={onSave} /> : null;
      })}
    </section>)}
  </div>;
}
