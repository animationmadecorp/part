import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

function SectionHeading({ section, id }) {
  return (section.heading || section.emphasis) ? <h2 id={id}>{section.heading}{section.emphasis ? <><br /><em>{section.emphasis}</em></> : null}</h2> : null;
}

export default function EditorialSections({ sections = [], styles }) {
  const selectedSections = styles?.length ? sections.filter((section) => styles.includes(section.style)) : sections;
  return selectedSections.map((section) => {
    const items = Array.isArray(section.items) ? section.items : [];
    const isProblems = section.style === "problems";
    const isCards = section.style === "cards";
    const isSteps = section.style === "steps";
    const isFeature = section.style === "feature";
    const isProse = section.style === "prose";

    if (section.style === "bio") {
      return <section id="apropos" key={section.stableId} aria-labelledby={`${section.stableId}-title`} className="am-intro am-container am-bio">
        <div className="am-portrait-wrap"><div className="am-portrait"><Image src="/portrait.webp" alt="Made, installée avec son ordinateur" fill priority sizes="(max-width: 760px) 90vw, 42vw" /></div></div>
        <div className="am-bio-copy"><SectionHeading id={`${section.stableId}-title`} section={section} />{items.map((item) => <p key={item.stableId}>{item.body || item.title}</p>)}</div>
      </section>;
    }

    if (section.style === "gift") {
      return <section id="cadeaux" key={section.stableId} className="am-section am-container am-gifts">
        <div>
          {section.eyebrow ? <p className="am-eyebrow">{section.eyebrow}</p> : null}
          <SectionHeading section={section} />
          {section.body ? <p>{section.body}</p> : null}
          {items.map((item) => <p key={item.stableId}>{item.body || item.title}</p>)}
          {section.ctaLabel ? <Link className="am-button" href={section.ctaHref || "/nouveau/bibliotheque"}>{section.ctaLabel}</Link> : null}
        </div>
        <div className="am-gift-sheet"><Sparkles size={35} /><span>{section.sheetLabel}</span><strong>{section.sheetTitle}</strong><p>{section.sheetBody}</p></div>
      </section>;
    }

    return (
      <section key={section.stableId} className={isProblems ? "am-problems am-container" : isFeature ? "am-product-art am-review-submission" : "am-product-section"}>
        {section.eyebrow ? <p className="am-eyebrow">{section.eyebrow}</p> : null}
        <SectionHeading section={section} />
        {section.body ? <p>{section.body}</p> : null}
        {items.length > 0 && isProse ? (
          <div>{items.map((item) => <div className="am-editorial-prose-item" key={item.stableId}>{item.title ? <h3>{item.title}</h3> : null}{item.body ? <p>{item.body}</p> : null}</div>)}</div>
        ) : items.length > 0 && (isCards ? (
          <div className="am-review-contents">
            {items.map((item) => <div key={item.stableId}><h3>{item.title}</h3>{item.body ? <p>{item.body}</p> : null}</div>)}
          </div>
        ) : isSteps ? (
          <div>
            {items.map((item, index) => <div className="am-step" key={item.stableId}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3>{item.body ? <p>{item.body}</p> : null}</div></div>)}
          </div>
        ) : (
          <ul className={isProblems ? undefined : "am-review-choices"}>
            {items.map((item) => <li key={item.stableId}>{item.title ? <strong>{item.title}</strong> : null}{item.body ? <p>{item.body}</p> : null}</li>)}
          </ul>
        ))}
      </section>
    );
  });
}
