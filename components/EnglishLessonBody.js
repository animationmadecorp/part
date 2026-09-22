"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

// Renderer for the imported English lessons. Same custom syntax as the original
// english-lessons app: ==color:text== highlights and {{word|translation}} tips.
// (Per-student vocab auto-injection is dropped here — the platform copy is static.)

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function preprocess(src) {
  if (!src) return "";
  let out = src;
  // {{word|translation}} → tooltip span
  out = out.replace(/\{\{([^|{}]+)\|([^{}]+)\}\}/g, (_, w, t) => {
    return `<span class="en-tip" data-tip="${escapeAttr(t.trim())}">${w.trim()}</span>`;
  });
  // ==text== highlights (optional color prefix)
  out = out.replace(/==(yellow:|pink:|blue:|green:)?([\s\S]+?)==/g, (_, tag, text) => {
    const color = tag ? tag.replace(":", "") : "yellow";
    return `<span class="hl-${color}">${text}</span>`;
  });
  return out;
}

// Co-located styles so the prose renders correctly regardless of any globals.css
// cache. Same look as the original english-lessons site.
const PROSE_CSS = `
.en-prose { color:#1a1a1a; font-size:1rem; line-height:1.75; }
.en-prose h1,.en-prose h2,.en-prose h3 { color:#1a1a1a; line-height:1.15; font-weight:700; }
.en-prose h1 { font-size:1.9rem; margin:2.2rem 0 1rem; }
.en-prose h2 { font-size:1.45rem; margin:2.4rem 0 1rem; padding-bottom:.5rem; border-bottom:1px solid #e6e1d8; }
.en-prose h2:first-child { margin-top:.3rem; }
.en-prose h3 { font-size:1.02rem; margin:1.9rem 0 .6rem; color:#d11975; text-transform:uppercase; letter-spacing:.1em; }
.en-prose p { margin:.6rem 0; }
.en-prose br { display:block; content:""; margin-top:.25rem; }
.en-prose ul,.en-prose ol { margin:.75rem 0; padding-left:1.5rem; }
.en-prose ul { list-style:disc; }
.en-prose ol { list-style:decimal; }
.en-prose li { margin:.25rem 0; }
.en-prose strong { color:#1a1a1a; font-weight:700; }
.en-prose em { font-style:italic; }
.en-prose code { background:rgba(0,0,0,.05); padding:.1rem .35rem; border-radius:4px; font-size:.92em; font-family:ui-monospace,monospace; }
.en-prose table { border-collapse:collapse; margin:1rem 0; width:100%; }
.en-prose th,.en-prose td { border:1px solid #e6e1d8; padding:.5rem .8rem; text-align:left; }
.en-prose th { background:rgba(0,0,0,.03); font-weight:600; }
.en-prose hr { border:none; border-top:1px solid #e6e1d8; margin:2rem 0; }
.hl-yellow { background:#fff1a6; padding:.05em .2em; border-radius:3px; }
.hl-pink { background:#ffd4e0; padding:.05em .2em; border-radius:3px; }
.hl-blue { background:#cfe3ff; padding:.05em .2em; border-radius:3px; }
.hl-green { background:#cdebd0; padding:.05em .2em; border-radius:3px; }
`;

export default function EnglishLessonBody({ children }) {
  return (
    <div className="en-prose">
      <style>{PROSE_CSS}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
      >
        {preprocess(children || "")}
      </ReactMarkdown>
    </div>
  );
}
