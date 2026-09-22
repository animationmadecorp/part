"use client";

import { useEffect, useRef } from "react";

export default function PageRibbon() {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    const main = svg.parentElement;
    let frame;
    const draw = () => {
      const box = main.getBoundingClientRect();
      const width = box.width;
      const height = main.offsetHeight;
      const hero = main.querySelector(".am-hero").getBoundingClientRect();
      const bottom = hero.bottom - box.top - 10;
      const outside = 70;
      // One continuous path; joins travel outside the clipped page edges.
      let d = `M ${width + 10} -20 C ${width - 15} ${bottom * .7}, ${width * .9} ${bottom}, ${width * .62} ${bottom} S ${width * .15} ${bottom - 30}, ${-outside} ${bottom + 25}`;
      let left = true;
      let previousY = bottom + 25;
      for (const gap of main.querySelectorAll(".am-ribbon-gap")) {
        const rect = gap.getBoundingClientRect();
        const y = rect.top - box.top + rect.height / 2;
        const edge = left ? -outside : width + outside;
        const opposite = left ? width + outside : -outside;
        d += ` C ${edge} ${previousY + 50}, ${edge} ${y - 30}, ${edge} ${y - 12}`;
        d += ` C ${left ? width * .25 : width * .75} ${y - 35}, ${left ? width * .75 : width * .25} ${y + 35}, ${opposite} ${y + 12}`;
        previousY = y + 12;
        left = !left;
      }
      const edge = left ? -outside : width + outside;
      d += ` C ${edge} ${previousY + 70}, ${edge} ${height - 40}, ${edge} ${height + 20}`;
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.querySelector("path").setAttribute("d", d);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(main);
    for (const child of main.children) {
      if (child !== svg) observer.observe(child);
    }
    schedule();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  return <svg ref={svgRef} className="am-page-ribbon" aria-hidden="true" focusable="false" preserveAspectRatio="none">
    <defs>
      <linearGradient id="am-page-ribbon-opacity" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FCA900" stopOpacity=".08"/>
        <stop offset="45%" stopColor="#FCA900" stopOpacity=".25"/>
        <stop offset="100%" stopColor="#FCA900" stopOpacity="1"/>
      </linearGradient>
    </defs>
    <path fill="none" stroke="url(#am-page-ribbon-opacity)" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
  </svg>;
}
