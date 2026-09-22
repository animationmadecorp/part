"use client";

import { useEffect } from "react";

// When a page is rendered INSIDE an iframe (our in-place edit drawer), tag the
// document so the global nav chrome (header/footer) is hidden — the drawer just
// shows the editor form, like a clean layer over the site.
export default function IframeChrome() {
  useEffect(() => {
    try {
      if (window.self !== window.top) {
        document.documentElement.classList.add("in-iframe");
      }
    } catch {
      document.documentElement.classList.add("in-iframe");
    }
  }, []);
  return null;
}
