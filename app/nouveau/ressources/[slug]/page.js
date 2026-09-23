import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { Header, Footer } from "../../_components/Shared";
import { getPublicEditorialContent } from "@/lib/sanity/content";
import { safeArticleUrl } from "@/lib/sanity/article-core.mjs";
import { resolveResourceMedia } from "@/lib/sanity/resource-core.mjs";
import ResourceGallery from "../ResourceGallery";
import "../../articles/articles.css";

export const dynamic = "force-dynamic";

const portableTextComponents = {
  marks: {
    link: ({ value, children }) => {
      const href = safeArticleUrl(value?.href);
      return href ? <a href={href} rel="noopener noreferrer">{children}</a> : <>{children}</>;
    },
  },
  types: {
    image: ({ value }) => {
      const url = safeArticleUrl(value?.url, { image: true });
      return url && value.alt ? <Image className="am-resource-inline-image" src={url} alt={value.alt} width={1200} height={800} sizes="(max-width: 930px) 90vw, 930px" /> : null;
    },
  },
};

function ResourceActions({ resource, free, offer }) {
  return <div className="am-article-error-actions">
    {free && resource.downloadUrl ? <a className="am-button" href={resource.downloadUrl} download>Télécharger gratuitement le ZIP</a> : free ? <p role="status">Ressource en préparation.</p> : <>
      <Link className="am-button" href={offer}>Découvrir l’offre</Link>
      <Link href="/nouveau/bibliotheque?onglet=suivi">Déjà acheté ? Mon suivi</Link>
    </>}
  </div>;
}

function ResourceDetails({ items = [], title = "Détails techniques" }) {
  if (!items.length) return null;
  return <div className="am-resource-details">
    <h3>{title}</h3>
    <dl>{items.map((item, index) => <div key={`${item.label || "detail"}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
  </div>;
}

export default async function ResourcePage({ params }) {
  const { slug } = await params;
  const editorial = await getPublicEditorialContent();
  const resource = editorial.resources.find(item => item.id === slug);
  if (!resource) notFound();

  const free = resource.accessRule === "free";
  const offer = { review: "/nouveau/review", visibility: "/nouveau/visibilite", english: "/nouveau/anglais" }[resource.access] || "/nouveau#programmes";
  const { gallery, legacyBody, legacyCover } = resolveResourceMedia(resource);
  const shortPhrase = resource.summary || resource.subtitle || resource.description;
  const hasStructuredRecap = resource.recap?.length > 0;
  const hasStructuredInstallation = resource.installation?.length > 0;
  const recapBody = hasStructuredRecap || (resource.description && shortPhrase !== resource.description);
  const showLegacyInInstallation = legacyBody.length > 0 && !hasStructuredRecap && !hasStructuredInstallation;
  const showLegacyComplement = legacyBody.length > 0 && !showLegacyInInstallation && (!hasStructuredRecap || !hasStructuredInstallation);

  return <><Header/><main className="am-container am-articles">
    <Link href="/nouveau/bibliotheque">← Retour à la bibliothèque</Link>
    <p className="am-eyebrow">{resource.collection} · {resource.format} · {free ? "Offert" : resource.accessRule === "purchase" ? "Payant" : "Inclus dans une offre"}</p>
    <h1>{resource.title}</h1>
    {shortPhrase ? <p className="am-articles-intro">{shortPhrase}</p> : null}

    {gallery.length > 0 ? <ResourceGallery items={gallery} /> : legacyCover ? <div className="am-resource-legacy-cover"><Image src={legacyCover.url} alt={legacyCover.alt} width={1200} height={800} sizes="(max-width: 930px) 90vw, 930px" /></div> : null}

    <section className="am-resource-section am-resource-summary" aria-labelledby="resource-summary-title">
      <p className="am-eyebrow">À retenir</p>
      <h2 id="resource-summary-title">Récapitulatif</h2>
      {resource.recap?.length > 0 ? <div className="am-resource-richtext"><PortableText value={resource.recap} components={portableTextComponents} /></div> : recapBody ? <div className="am-resource-richtext"><p>{resource.description}</p></div> : null}
      {resource.metadata?.length > 0 ? <dl className="am-resource-summary-list">{resource.metadata.map((item, index) => <div key={`${item.label || "metadata"}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}
    </section>

    <section className="am-resource-section am-resource-installation" aria-labelledby="resource-installation-title">
      <p className="am-eyebrow">Passer à l’action</p>
      <h2 id="resource-installation-title">Installation et détails</h2>
      <ResourceActions resource={resource} free={free} offer={offer} />
      {resource.installation?.length > 0 ? <div className="am-resource-richtext"><PortableText value={resource.installation} components={portableTextComponents} /></div> : showLegacyInInstallation ? <div className="am-resource-richtext"><PortableText value={legacyBody} components={portableTextComponents} /></div> : null}
      <ResourceDetails items={resource.technicalDetails} />
      {resource.license ? <div className="am-resource-license"><h3>Licence</h3><p>{resource.license}</p></div> : null}
    </section>

    {showLegacyComplement ? <section className="am-resource-section am-resource-richtext" aria-labelledby="resource-complement-title">
      <h2 id="resource-complement-title">Complément</h2>
      <PortableText value={legacyBody} components={portableTextComponents} />
    </section> : null}
  </main><Footer/></>;
}
