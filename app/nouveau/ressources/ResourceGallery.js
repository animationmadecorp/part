"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function GalleryMedia({ item, modal = false }) {
  if (item.type === "video") {
    return <video
      className={modal ? "am-resource-gallery-dialog-video" : "am-resource-gallery-video"}
      src={item.url}
      poster={item.posterUrl || undefined}
      controls={modal}
      muted={!modal}
      playsInline
      preload="metadata"
      aria-label={item.alt}
    />;
  }

  return <Image
    className={modal ? "am-resource-gallery-dialog-image" : "am-resource-gallery-image"}
    src={item.url}
    alt={modal ? item.alt : ""}
    width={1200}
    height={800}
    sizes={modal ? "(max-width: 760px) 90vw, 820px" : "(max-width: 760px) 72vw, 260px"}
  />;
}

function focusableElements(dialog) {
  return [...dialog.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), video[controls]',
  )];
}

export default function ResourceGallery({ items = [] }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [dialogTitleId, setDialogTitleId] = useState("resource-gallery-dialog-title");
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(null);
  const dialogRef = useRef(null);
  const isOpen = openIndex !== null;

  useEffect(() => {
    if (!isOpen) {
      const returnFocus = returnFocusRef.current;
      if (returnFocus && typeof returnFocus.focus === "function") {
        requestAnimationFrame(() => returnFocus.focus());
      }
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenIndex(null);
        return;
      }
      if (event.target?.closest?.("video") && ["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (event.key === "ArrowRight" && items.length > 1) {
        event.preventDefault();
        setOpenIndex((index) => (index + 1) % items.length);
        return;
      }
      if (event.key === "ArrowLeft" && items.length > 1) {
        event.preventDefault();
        setOpenIndex((index) => (index - 1 + items.length) % items.length);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current ? focusableElements(dialogRef.current) : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [items.length, isOpen]);

  if (!Array.isArray(items) || items.length === 0) return null;
  const activeItem = openIndex === null ? null : items[openIndex];

  function open(index, event) {
    returnFocusRef.current = event.currentTarget;
    setDialogTitleId(`resource-gallery-dialog-title-${index}`);
    setOpenIndex(index);
  }

  function close() {
    setOpenIndex(null);
  }

  function move(delta) {
    setOpenIndex((index) => (index + delta + items.length) % items.length);
  }

  return <section className="am-resource-gallery" aria-labelledby="am-resource-gallery-title">
    <div className="am-resource-gallery-heading">
      <h2 id="am-resource-gallery-title">Aperçus</h2>
      <span>{items.length} {items.length === 1 ? "visuel" : "visuels"}</span>
    </div>
    <div className="am-resource-gallery-strip" role="list" aria-label="Aperçus de la ressource">
      {items.map((item, index) => <div role="listitem" key={`${item.assetRef || item.url}-${index}`}>
        <button
          type="button"
          className="am-resource-gallery-trigger"
          onClick={(event) => open(index, event)}
          aria-label={`${item.type === "video" ? "Lire" : "Agrandir"} : ${item.alt}`}
        >
          <span className="am-resource-gallery-thumb"><GalleryMedia item={item}/></span>
          <span className="am-resource-gallery-trigger-label">{item.type === "video" ? "Vidéo" : "Agrandir"}</span>
        </button>
      </div>)}
    </div>
    {activeItem ? <div
      className="am-resource-gallery-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div
        className="am-resource-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        ref={dialogRef}
      >
        <div className="am-resource-gallery-dialog-heading">
          <h2 id={dialogTitleId}>{activeItem.type === "video" ? "Vidéo de présentation" : "Aperçu"}</h2>
          <button type="button" className="am-resource-gallery-close" onClick={close} ref={closeButtonRef} aria-label="Fermer l’aperçu">×</button>
        </div>
        <div className="am-resource-gallery-dialog-media"><GalleryMedia item={activeItem} modal /></div>
        {activeItem.caption ? <p className="am-resource-gallery-caption">{activeItem.caption}</p> : <p className="am-resource-gallery-caption">{activeItem.alt}</p>}
        {items.length > 1 ? <div className="am-resource-gallery-dialog-actions">
          <button type="button" className="am-outline am-button am-button-small" onClick={() => move(-1)} aria-label="Visuel précédent">← Précédent</button>
          <span aria-live="polite">{openIndex + 1} / {items.length}</span>
          <button type="button" className="am-outline am-button am-button-small" onClick={() => move(1)} aria-label="Visuel suivant">Suivant →</button>
        </div> : null}
      </div>
    </div> : null}
  </section>;
}
