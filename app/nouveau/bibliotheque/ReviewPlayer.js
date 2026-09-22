"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import "./review-player.css";

// Same normalized stroke / timecoded comment format as ReviewStudio.
// Received reviews are read-only; local previews never receive their annotations.
export default function ReviewPlayer({ src = null, strokes = [], textBoxes = [], comments = [], fps = 24, aspectRatio = null }) {
  const video = useRef(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState("");
  const [measuredRatio, setMeasuredRatio] = useState(16 / 9);
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : measuredRatio;
  const source = typeof src === "string" && src.startsWith("/api/review-media/") ? src : null;
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 24;
  const frame = Math.round(time * rate);
  const drawings = strokes;
  const notes = comments;
  const texts = textBoxes;
  useEffect(() => {
    const element = video.current;
    if (!element || !playing) return;
    let id;
    const tick = () => { setTime(element.currentTime); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  function seek(value) {
    if (!video.current || !duration) return;
    video.current.pause();
    const next = Math.max(0, Math.min(value, Math.max(0, duration - 1 / rate)));
    video.current.currentTime = next;
    setTime(next);
  }
  async function toggle() {
    if (!video.current) return;
    if (playing) video.current.pause();
    else try { await video.current.play(); } catch { setError("La lecture n’a pas démarré. Réessaie ou choisis un MP4 H.264."); }
  }
  const markers = [...new Set([...drawings.map(s => s.frame / rate), ...texts.map(s => s.frame / rate), ...notes.map(c => c.time)])].sort((a,b) => a-b);
  return <section className="am-review-player" aria-label="Lecteur du retour annoté">
    <div className="am-review-layout"><div>
      <div className="am-review-stage" style={{ aspectRatio: ratio }}>
        {source ? <>
          <video key={source} ref={video} src={source} playsInline preload="metadata"
            onLoadedMetadata={event => { const v = event.currentTarget; if (!Number.isFinite(v.duration) || v.duration > 15.05) { setError("Cette vidéo dépasse la limite de 15 secondes."); return; } setDuration(v.duration); setMeasuredRatio(v.videoWidth / v.videoHeight || 16 / 9); }}
            onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setDuration(0); setError("Cette vidéo ne peut pas être lue. Essaie un export MP4 H.264."); }} />
          {visible && <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Dessins de correction">{drawings.filter(s => s.frame <= frame && (s.end ?? s.frame) >= frame).map((s,i) => <polyline key={i} points={s.pts.map(([x,y]) => `${x*1000},${y*1000}`).join(" ")} stroke={s.color} strokeWidth={s.size} vectorEffect="non-scaling-stroke" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</svg>}
          {visible && texts.filter(t => t.frame <= frame && (t.end ?? t.frame) >= frame).map((t,i) => <span className="am-review-textbox" key={t.id || i} style={{ left: `${t.x*100}%`, top: `${t.y*100}%`, color: t.color, fontSize: `${t.size/10}cqw` }}>{t.text}</span>)}
        </> : <div className="am-review-empty"><Film size={40} /><h3>Ton animation, image par image.</h3><p>La vidéo et les dessins apparaîtront ici dès la remise de ton retour.</p></div>}
      </div>
      <div className="am-review-transport">
        <button type="button" disabled={!duration} aria-label="Image précédente" onClick={() => seek(time - 1/rate)}><SkipBack size={18} /></button>
        <button type="button" disabled={!duration} aria-label={playing ? "Pause" : "Lire"} onClick={toggle}>{playing ? <Pause size={20}/> : <Play size={20}/>}</button>
        <button type="button" disabled={!duration} aria-label="Image suivante" onClick={() => seek(time + 1/rate)}><SkipForward size={18}/></button>
        <span>{time.toFixed(2).replace(".", ",")} s · Image {frame}</span>
      </div>
      <input className="am-review-range" type="range" aria-label="Position dans la vidéo" min={0} max={duration || 1} step={1/rate} value={time} disabled={!duration} onChange={e => seek(Number(e.target.value))}/>
      <div className="am-review-marks">{markers.map(t => <button type="button" key={t} disabled={!duration} onClick={() => seek(t)}>Image {Math.round(t*rate)}</button>)}</div>
      <label className="am-review-toggle"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)}/> Afficher les dessins</label>
    </div><aside className="am-review-notes"><h3>Les commentaires</h3>{notes.length ? [...notes].sort((a,b)=>a.time-b.time).map((note,i) => <button type="button" key={note.id || i} disabled={!duration} onClick={() => seek(note.time)}><span>{note.time.toFixed(2).replace(".", ",")} s · Image {Math.round(note.time*rate)}</span><p>{note.text}</p></button>) : <p>Les remarques de Made seront regroupées ici, avec un accès direct au passage concerné.</p>}</aside></div>
    {error && <p role="alert" className="am-deposit-error">{error}</p>}
  </section>;
}
