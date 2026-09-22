"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery_experimental } from "convex/react";
import { getReviewStudioQueryArgs, getReviewStudioStatus } from "./reviewStudioAccess.mjs";

const MAX_SECONDS = 15;
const COLORS = ["#FF4D4D", "#ECAB3F", "#B6A8E6", "#EC8FB6", "#FFFFFF"];

function fmt(t) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sameDimensions(left, right) {
  return left?.width === right?.width && left?.height === right?.height;
}

export default function ReviewStudio(props) {
  const { isLoaded: clerkLoaded, userId: clerkUserId } = useAuth();
  const identityKey = clerkLoaded ? clerkUserId || "signed-out" : "auth-loading";
  const instanceKey = `${identityKey}:${props.requestId || props.requestContext?.requestId || "no-request"}:${props.sourceFileId || props.requestContext?.sourceFileId || "no-source"}:${props.cycleNumber || 1}`;
  return <ReviewStudioContent key={instanceKey} {...props} clerkLoaded={clerkLoaded} clerkUserId={clerkUserId}/>;
}

function ReviewStudioContent({
  maxSeconds = MAX_SECONDS,
  persist = true,
  requestId = null,
  sourceFileId = null,
  cycleNumber = 1,
  requestContext = null,
  clerkLoaded = false,
  clerkUserId = null,
}) {
  const reviewRequestId = requestId || requestContext?.requestId || null;
  const reviewSourceFileId = sourceFileId || requestContext?.sourceFileId || null;
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const reviewQueryArgs = getReviewStudioQueryArgs({
    authLoading,
    isAuthenticated,
    clerkLoaded,
    clerkUserId,
    requestId: reviewRequestId,
    cycleNumber,
    sourceFileId: reviewSourceFileId,
  });
  const reviewResult = useQuery_experimental({ query: "reviewStudio:getAdminReview", args: reviewQueryArgs });
  const reviewStatus = getReviewStudioStatus({ authLoading, isAuthenticated, clerkLoaded, clerkUserId, queryStatus: reviewResult.status });
  const review = reviewStatus === "ready" && reviewResult.status === "success" ? reviewResult.data : undefined;
  const reviewQueryError = reviewStatus === "error" && reviewResult.status === "error" ? reviewResult.error : null;
  const ensureReview = useMutation("reviewStudio:ensureReview");
  const saveReview = useMutation("reviewStudio:saveReview");
  const publishReview = useMutation("reviewStudio:publishReview");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drawingRef = useRef(null);
  const dragText = useRef(null);
  const hydratedKeyRef = useRef(null);
  const dirtyRef = useRef(false);
  const dirtyVersionRef = useRef(0);
  const ensureInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const metadataRef = useRef({ requestId: null, sourceId: null, duration: 0, width: null, height: null });

  const [fps, setFps] = useState(24);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: null, height: null });
  const [strokes, setStrokes] = useState([]);
  const [textBoxes, setTextBoxes] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [comments, setComments] = useState([]);
  const [color, setColor] = useState(COLORS[0]);
  const [brush, setBrush] = useState(4);
  const [commentText, setCommentText] = useState("");
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle");
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState("");

  const videoUrl = review?.videoUrl || null;
  const frame = Math.round(time * fps);
  const activeText = textBoxes.find((item) => item.id === selectedText);
  const maxFrame = Math.floor((duration || 0) * fps);
  const hasReviewContent = strokes.length > 0 || textBoxes.some((item) => item.text.trim()) || comments.length > 0;
  const canEdit = Boolean(review?.id) && review?.status === "draft" && !conflict;

  function markDirty() {
    dirtyVersionRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    setStatus("pending");
  }

  // A query update is allowed to hydrate the editor only while it is clean.
  // Local edits are never silently replaced by another administrator's save.
  useEffect(() => {
    if (!review) return;
    if (dirtyRef.current && hydratedKeyRef.current?.startsWith(`${review.id || "new"}:`)) return;
    const key = `${review.id || "new"}:${review.revision}`;
    if (hydratedKeyRef.current === key) return;
    const localMetadata = metadataRef.current.requestId === review.requestId && metadataRef.current.sourceId === review.source?.id
      ? metadataRef.current
      : { duration: 0, width: null, height: null };
    const nextDuration = Number(review.duration) || localMetadata.duration || 0;
    const nextSize = review.videoWidth && review.videoHeight
      ? { width: review.videoWidth, height: review.videoHeight }
      : { width: localMetadata.width, height: localMetadata.height };
    hydratedKeyRef.current = key;
    setStrokes(Array.isArray(review.strokes) ? review.strokes : []);
    setTextBoxes(Array.isArray(review.textBoxes) ? review.textBoxes : []);
    setComments(Array.isArray(review.comments) ? review.comments : []);
    setFps(Number(review.fps) || 24);
    setDuration(nextDuration);
    setVideoSize(nextSize);
    setRevision(Number(review.revision) || 0);
    setSelectedText(null);
    setConflict(null);
    const metadataNeedsSave = Boolean(review.id && localMetadata.duration && (!review.duration || !review.videoWidth || !review.videoHeight));
    dirtyRef.current = metadataNeedsSave;
    if (metadataNeedsSave) dirtyVersionRef.current += 1;
    setDirty(metadataNeedsSave);
    setSaving(false);
    setStatus(review.status === "published" ? "published" : metadataNeedsSave ? "pending" : review.id ? "saved" : "loading");
    setError("");
  }, [review]);

  // The server creates the one draft row lazily, after the ACL check has
  // selected the paid dossier's actual video file.
  useEffect(() => {
    if (!reviewRequestId || !review || review.id || ensureInFlightRef.current || review.status === "published") return;
    ensureInFlightRef.current = true;
    ensureReview({
      requestId: reviewRequestId,
      cycleNumber,
      ...(reviewSourceFileId ? { sourceFileId: reviewSourceFileId } : {}),
    }).catch((failure) => {
      setError(failure instanceof Error ? failure.message : "Le brouillon n’a pas pu être initialisé.");
      setStatus("error");
    }).finally(() => {
      ensureInFlightRef.current = false;
    });
  }, [cycleNumber, ensureReview, review, reviewRequestId, reviewSourceFileId]);

  // Debounced optimistic autosave. The mutation compares the revision that
  // was rendered, so two open editors cannot overwrite each other silently.
  useEffect(() => {
    if (!persist || !dirty || !canEdit || saving || conflict || !duration || !videoSize.width || !videoSize.height) return undefined;
    const timer = window.setTimeout(async () => {
      if (saveInFlightRef.current) return;
      const saveVersion = dirtyVersionRef.current;
      saveInFlightRef.current = true;
      setSaving(true);
      setError("");
      try {
        const result = await saveReview({
          requestId: reviewRequestId,
          cycleNumber,
          ...(reviewSourceFileId ? { sourceFileId: reviewSourceFileId } : {}),
          expectedRevision: revision,
          strokesJson: JSON.stringify(strokes),
          textBoxesJson: JSON.stringify(textBoxes),
          commentsJson: JSON.stringify(comments),
          fps,
          duration,
          videoWidth: videoSize.width,
          videoHeight: videoSize.height,
        });
        if (result?.conflict) {
          setConflict(result.current || null);
          setStatus("conflict");
          setError("Une autre fenêtre a enregistré cette review. Recharge sa version avant de continuer.");
        } else if (result?.ok) {
          setRevision(result.revision);
          if (dirtyVersionRef.current === saveVersion) {
            dirtyRef.current = false;
            setDirty(false);
            setStatus("saved");
          } else {
            // Keep edits made while the request was in flight. The effect will
            // enqueue the latest state against the revision just returned.
            dirtyRef.current = true;
            setDirty(true);
            setStatus("pending");
          }
        }
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "La sauvegarde automatique a échoué.");
        setStatus("error");
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [comments, canEdit, conflict, cycleNumber, dirty, duration, fps, persist, reviewRequestId, reviewSourceFileId, revision, saveReview, saving, strokes, textBoxes, videoSize]);

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.getContext("2d")?.scale(ratio, ratio);
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, rect.width, rect.height);
    const draw = (stroke) => {
      if (!stroke.pts?.length) return;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.size;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      stroke.pts.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x * rect.width, y * rect.height);
        else context.lineTo(x * rect.width, y * rect.height);
      });
      context.stroke();
    };
    strokes.filter((stroke) => stroke.frame <= frame && (stroke.end ?? stroke.frame) >= frame).forEach(draw);
    if (drawingRef.current) draw(drawingRef.current);
  }, [frame, strokes]);

  useEffect(() => {
    redraw();
  }, [redraw, time]);

  useEffect(() => {
    sizeCanvas();
    redraw();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      sizeCanvas();
      redraw();
    });
    if (wrapRef.current && observer) observer.observe(wrapRef.current);
    return () => observer?.disconnect();
  }, [redraw, sizeCanvas, videoUrl]);

  function onLoadedMetadata(event) {
    const video = event.currentTarget;
    const nextDuration = Number(video.duration);
    if (!Number.isFinite(nextDuration) || nextDuration > maxSeconds + 0.05) {
      setError(`Vidéo trop longue ou illisible. Maximum ${maxSeconds}s pour une review.`);
      return;
    }
    const nextSize = { width: video.videoWidth || null, height: video.videoHeight || null };
    metadataRef.current = { requestId: reviewRequestId, sourceId: review?.source?.id || null, duration: nextDuration, ...nextSize };
    setDuration(nextDuration);
    setVideoSize(nextSize);
    if (review?.duration !== nextDuration || !sameDimensions(nextSize, { width: review?.videoWidth, height: review?.videoHeight })) {
      markDirty();
    }
    setError("");
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => setError("La lecture n’a pas démarré. Vérifie le format MP4 H.264."));
    else video.pause();
  }

  function step(direction) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.min(Math.max(0, video.currentTime + direction / fps), duration || video.duration || 0);
  }

  function seek(value) {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(value, duration || value));
  }

  const rvfc = useCallback(() => {
    const video = videoRef.current;
    if (!video?.requestVideoFrameCallback) return;
    const callback = (_now, metadata) => {
      setTime(metadata.mediaTime);
      if (!video.paused) video.requestVideoFrameCallback(callback);
    };
    video.requestVideoFrameCallback(callback);
  }, []);

  function position(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    ];
  }

  function startDraw(event) {
    if (!canEdit) return;
    event.preventDefault();
    setSelectedText(null);
    videoRef.current?.pause();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = { frame, end: frame, color, size: brush, pts: [position(event)] };
  }

  function moveDraw(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current.pts.push(position(event));
    redraw();
  }

  function endDraw() {
    if (!drawingRef.current) return;
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke.pts.length > 1) {
      setStrokes((current) => [...current, stroke]);
      markDirty();
    }
  }

  const covers = (item, currentFrame) => item.frame <= currentFrame && (item.end ?? item.frame) >= currentFrame;

  function clearFrame() {
    if (!canEdit) return;
    setStrokes((current) => current.filter((stroke) => !covers(stroke, frame)));
    setTextBoxes((current) => current.filter((item) => !covers(item, frame)));
    markDirty();
  }

  function undo() {
    if (!canEdit) return;
    setStrokes((current) => {
      let index = -1;
      current.forEach((stroke, positionIndex) => { if (covers(stroke, frame)) index = positionIndex; });
      if (index < 0) return current;
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
    markDirty();
  }

  const startingHere = strokes.filter((stroke) => stroke.frame === frame);
  const curEnd = startingHere.length ? Math.max(...startingHere.map((stroke) => stroke.end ?? stroke.frame)) : frame;
  const durFrames = curEnd - frame + 1;

  function setDur(delta) {
    if (!canEdit) return;
    const nextEnd = Math.min(Math.max(frame, curEnd + delta), maxFrame);
    setStrokes((current) => current.map((stroke) => stroke.frame === frame ? { ...stroke, end: nextEnd } : stroke));
    setTextBoxes((current) => current.map((item) => item.frame === frame ? { ...item, end: nextEnd } : item));
    markDirty();
  }

  const spans = (() => {
    const seen = new Set();
    const values = [];
    [...strokes, ...textBoxes].forEach((item) => {
      const end = item.end ?? item.frame;
      const key = `${item.frame}-${end}`;
      if (!seen.has(key)) {
        seen.add(key);
        values.push({ start: item.frame, end });
      }
    });
    return values;
  })();

  function addComment() {
    if (!canEdit || !commentText.trim()) return;
    setComments((current) => [...current, { id: `${Date.now()}-${current.length}`, time, text: commentText.trim() }].sort((a, b) => a.time - b.time));
    setCommentText("");
    markDirty();
  }

  function updateText(values) {
    if (!canEdit) return;
    setTextBoxes((items) => items.map((item) => item.id === selectedText ? { ...item, ...values } : item));
    markDirty();
  }

  function addText() {
    if (!canEdit) return;
    videoRef.current?.pause();
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${textBoxes.length}`;
    setTextBoxes((items) => [...items, { id, frame, end: frame, x: 0.1, y: 0.1, text: "", color, size: 24 }]);
    setSelectedText(id);
    markDirty();
  }

  async function publish() {
    if (!reviewRequestId || !review?.id || dirty || saving || conflict || !hasReviewContent || status === "published") return;
    setError("");
    try {
      const result = await publishReview({ requestId: reviewRequestId, cycleNumber, expectedRevision: revision, ...(reviewSourceFileId ? { sourceFileId: reviewSourceFileId } : {}) });
      if (result?.conflict) {
        setConflict(result.current || null);
        setStatus("conflict");
        setError("Une autre fenêtre a modifié la review. Recharge sa version avant de la publier.");
      } else if (result?.ok) {
        setStatus("published");
        setRevision(result.snapshot.revision);
        setDirty(false);
        dirtyRef.current = false;
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "La publication a échoué.");
      setStatus("error");
    }
  }

  function reloadConflict() {
    if (!conflict) return;
    setStrokes(conflict.strokes || []);
    setTextBoxes(conflict.textBoxes || []);
    setComments(conflict.comments || []);
    setFps(conflict.fps || 24);
    setDuration(conflict.duration || 0);
    setVideoSize({ width: conflict.videoWidth || null, height: conflict.videoHeight || null });
    setRevision(conflict.revision || 0);
    setConflict(null);
    setDirty(false);
    dirtyRef.current = false;
    setStatus("saved");
    setError("");
  }

  if (!reviewRequestId) {
    return <div className="rv-drop"><p className="text-muted">Sélectionne un dossier payé depuis les demandes pour ouvrir son studio de review.</p></div>;
  }
  if (reviewStatus === "auth-loading") {
    return <div className="rv-drop" role="status"><p className="text-muted">Vérification de la session administrateur…</p></div>;
  }
  if (reviewStatus === "unauthenticated") {
    return <div className="rv-drop" role="alert"><p className="text-muted">La session administrateur n’est pas disponible. Reconnecte-toi pour ouvrir cette review.</p></div>;
  }
  if (reviewStatus === "error") {
    const message = reviewQueryError instanceof Error && reviewQueryError.message
      ? reviewQueryError.message
      : typeof reviewQueryError === "string" && reviewQueryError
        ? reviewQueryError
        : "La requête Convex n’a pas pu charger cette review.";
    return <div className="rv-drop" role="alert"><p className="text-muted">La vidéo privée du dossier n’a pas pu être chargée.</p><small>{message}</small></div>;
  }
  if (review === undefined) {
    return <div className="rv-drop" role="status"><p className="text-muted">Chargement de la vidéo privée du dossier…</p></div>;
  }

  const displayName = requestContext?.requestName || "Dossier payé";
  const displayPlan = requestContext?.planName || review.source?.name || "Vidéo du dossier";
  const markers = [...new Set([...strokes, ...textBoxes].map((item) => item.frame))].sort((a, b) => a - b);
  const framesWithStrokes = markers;

  return <div className="rv">
    {!videoUrl ? <div className="rv-drop"><p className="text-muted">La vidéo privée n’est pas disponible pour ce dossier.</p>{error && <p className="text-accent text-sm mt-3" role="alert">{error}</p>}</div> : <div className="rv-grid">
      <div>
        <div className="rv-stage" ref={wrapRef} style={{ aspectRatio: videoSize.width && videoSize.height ? `${videoSize.width}/${videoSize.height}` : "16/9" }}>
          <video ref={videoRef} src={videoUrl} className="rv-video" onLoadedMetadata={onLoadedMetadata} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onPlay={() => { setPlaying(true); rvfc(); }} onPause={() => setPlaying(false)} playsInline preload="metadata" />
          <canvas ref={canvasRef} className="rv-canvas" aria-label="Zone de dessin sur la vidéo" onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerCancel={endDraw} onPointerLeave={endDraw} />
          {textBoxes.filter((item) => covers(item, frame)).map((item) => <div key={item.id} className="rv-textbox" role="group" tabIndex={0} aria-label={`Encadré déplaçable sur l'image ${item.frame}`} data-selected={selectedText === item.id} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, color: item.color, fontSize: `${item.size / 10}cqw` }} onClick={() => setSelectedText(item.id)} onPointerDown={(event) => { if (!canEdit || event.target.tagName === "TEXTAREA") return; event.preventDefault(); videoRef.current?.pause(); setSelectedText(item.id); event.currentTarget.setPointerCapture(event.pointerId); dragText.current = { x: event.clientX, y: event.clientY, originX: item.x, originY: item.y }; }} onPointerMove={(event) => { if (!dragText.current || !canEdit) return; const rect = wrapRef.current.getBoundingClientRect(); const box = event.currentTarget.getBoundingClientRect(); const drag = dragText.current; setTextBoxes((items) => items.map((textBox) => textBox.id === item.id ? { ...textBox, x: Math.max(0, Math.min(1 - box.width / rect.width, drag.originX + (event.clientX - drag.x) / rect.width)), y: Math.max(0, Math.min(1 - box.height / rect.height, drag.originY + (event.clientY - drag.y) / rect.height)) } : textBox)); markDirty(); }} onPointerUp={() => { dragText.current = null; }} onPointerCancel={() => { dragText.current = null; }} onKeyDown={(event) => { const offsets = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }; const delta = offsets[event.key]; if (!delta || !canEdit) return; event.preventDefault(); const rect = wrapRef.current.getBoundingClientRect(); const box = event.currentTarget.getBoundingClientRect(); setTextBoxes((items) => items.map((textBox) => textBox.id === item.id ? { ...textBox, x: Math.max(0, Math.min(1 - box.width / rect.width, textBox.x + delta[0])), y: Math.max(0, Math.min(1 - box.height / rect.height, textBox.y + delta[1])) } : textBox)); markDirty(); }}><span className="rv-text-handle" aria-hidden="true">⠿</span><textarea autoFocus={selectedText === item.id} aria-label="Texte sur la vidéo" placeholder="Écris ici…" value={item.text} maxLength={240} rows={Math.min(6, Math.max(2, item.text.split("\n").length))} disabled={!canEdit} onFocus={() => { videoRef.current?.pause(); setSelectedText(item.id); }} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => { setTextBoxes((items) => items.map((textBox) => textBox.id === item.id ? { ...textBox, text: event.target.value } : textBox)); markDirty(); }} /></div>)}
        </div>
        <div className="rv-transport"><button type="button" className="rv-btn" onClick={() => step(-1)} disabled={!duration} aria-label="Image précédente">◀ı</button><button type="button" className="rv-btn rv-play" onClick={togglePlay} disabled={!duration} aria-label={playing ? "Mettre la vidéo en pause" : "Lire la vidéo"}>{playing ? "❚❚" : "▶"}</button><button type="button" className="rv-btn" onClick={() => step(1)} disabled={!duration} aria-label="Image suivante">ı▶</button><span className="rv-time">{fmt(time)} · image {frame}</span></div>
        <div className="rv-timeline">{duration > 0 && <div className="rv-markers">{spans.map((span, index) => <button type="button" key={index} className={span.end > span.start ? "rv-mk-bar" : "rv-mk-dot"} style={{ left: `${((span.start / fps) / duration) * 100}%`, ...(span.end > span.start ? { width: `${Math.max((((span.end - span.start) / fps) / duration) * 100, 0.6)}%` } : {}) }} onClick={() => seek(span.start / fps)} aria-label={`Image ${span.start}`} />)}</div>}<input type="range" min={0} max={duration || 0} step={1 / fps} value={time} onChange={(event) => seek(parseFloat(event.target.value))} className="rv-scrub" aria-label="Position dans la vidéo" disabled={!duration} /></div>
        <div className="rv-tools"><label>Images/s <select aria-label="Cadence de la vidéo" value={fps} disabled={!canEdit} onChange={(event) => { setFps(Number(event.target.value)); markDirty(); }}>{[24, 25, 30, 48, 50, 60].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="flex items-center gap-2">{COLORS.map((swatch) => <button type="button" key={swatch} onClick={() => { setColor(swatch); if (activeText) updateText({ color: swatch }); }} className={`rv-swatch ${(activeText?.color || color) === swatch ? "on" : ""}`} style={{ background: swatch }} aria-label={`Couleur ${swatch}`} title={`Couleur ${swatch}`} disabled={!canEdit} />)}</div><div className="flex items-center gap-2 text-sm text-muted"><button type="button" className="rv-btn-text" onClick={() => setSelectedText(null)}>Pinceau</button><button type="button" className="rv-btn-text" aria-label="Ajouter du texte sur la vidéo" title="Texte" onClick={addText} disabled={!canEdit}><strong>T</strong></button><input type="range" min={2} max={14} value={brush} onChange={(event) => setBrush(parseInt(event.target.value, 10))} aria-label="Taille du pinceau" disabled={!canEdit} /></div><button type="button" className="rv-btn-text" onClick={undo} disabled={!canEdit}>Annuler</button><button type="button" className="rv-btn-text" onClick={clearFrame} disabled={!canEdit}>Effacer l’image</button>{startingHere.length > 0 && <div className="rv-dur"><span>Durée</span><button type="button" className="rv-btn" onClick={() => setDur(-1)} disabled={!canEdit || durFrames <= 1}>−</button><span className="rv-dur-n">{durFrames} image{durFrames > 1 ? "s" : ""}</span><button type="button" className="rv-btn" onClick={() => setDur(1)} disabled={!canEdit || curEnd >= maxFrame}>+</button></div>}<span className="text-muted text-xs ml-auto">{framesWithStrokes.length} image(s) annotée(s)</span></div>{activeText && <div className="rv-text-delete"><button type="button" className="rv-btn-text" onClick={() => { setTextBoxes((items) => items.filter((item) => item.id !== selectedText)); setSelectedText(null); markDirty(); }} disabled={!canEdit}>Supprimer le texte</button></div>}
      </div>
      <aside className="rv-side"><h3 className="font-display text-lg mb-3">Commentaires</h3><div className="flex gap-2 mb-4"><input className="input text-sm" aria-label={`Commentaire pour l’image ${frame}`} placeholder={`Note à l'image ${frame}...`} value={commentText} disabled={!canEdit} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addComment()} /><button type="button" className="pill btn-primary text-sm shrink-0" onClick={addComment} disabled={!canEdit} aria-label="Ajouter le commentaire">+</button></div>{comments.length === 0 ? <p className="text-muted text-sm">Aucun commentaire. Mets en pause sur une image et annote.</p> : <div className="flex flex-col gap-2">{comments.map((comment) => <button type="button" key={comment.id} className="rv-comment" onClick={() => seek(comment.time)}><span className="rv-tc">Image {Math.round(comment.time * fps)} <span className="rv-tc-sub">({fmt(comment.time)})</span></span><span>{comment.text}</span></button>)}</div>}</aside>
    </div>}
    {error && <p role="alert" className="rv-error">{error}</p>}
    {review?.id && <section className="rv-ready" aria-labelledby="review-ready-title"><div><h3 id="review-ready-title">{status === "published" ? "Review publiée" : "Finaliser cette review"}</h3><p>{displayName} · {displayPlan}</p><small>{status === "published" ? "Version figée, visible par le client payé." : saving ? "Sauvegarde en cours…" : dirty ? "Modifications non enregistrées…" : status === "conflict" ? "Conflit à résoudre." : "Toutes les modifications sont enregistrées."}</small></div><button type="button" className="pill btn-primary" disabled={!canEdit || dirty || saving || !hasReviewContent} onClick={publish}>{status === "published" ? "Version publiée" : "Publier la version"}</button>{conflict && <div className="rv-conflict" role="alert"><p>Cette review a changé dans une autre fenêtre. Tes modifications locales sont conservées mais bloquées.</p><button type="button" className="rv-btn-text" onClick={reloadConflict}>Recharger la version serveur</button></div>}{requestContext?.returnHref && <Link href={requestContext.returnHref}>Retour au dossier</Link>}</section>}
  </div>;
}
