import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { Header, Footer } from "../../_components/Shared";
import { getPublicEditorialContent } from "@/lib/sanity/content";
import { safeArticleUrl } from "@/lib/sanity/article-core.mjs";
import "../../articles/articles.css";

export const dynamic = "force-dynamic";
const components = {
  marks: { link: ({ value, children }) => { const href = safeArticleUrl(value?.href); return href ? <a href={href} rel="noopener noreferrer">{children}</a> : <>{children}</>; } },
  types: { image: ({ value }) => { const url = safeArticleUrl(value?.url, { image: true }); return url && value.alt ? <Image src={url} alt={value.alt} width={1200} height={800} sizes="(max-width: 930px) 90vw, 930px" /> : null; } },
};
export default async function ResourcePage({ params }) {
  const { slug } = await params;
  const editorial = await getPublicEditorialContent();
  const resource = editorial.resources.find(item => item.id === slug);
  if (!resource) notFound();
  const free = resource.accessRule === "free";
  const offer = { review: "/nouveau/review", visibility: "/nouveau/visibilite", english: "/nouveau/anglais" }[resource.access] || "/nouveau#programmes";
  return <><Header/><main className="am-container am-articles">
    <Link href="/nouveau/bibliotheque">← Retour à la bibliothèque</Link>
    <p className="am-eyebrow">{resource.collection} · {resource.format} · {free ? "Offert" : resource.accessRule === "purchase" ? "Payant" : "Inclus dans une offre"}</p>
    <h1>{resource.title}</h1><p className="am-articles-intro">{resource.description}</p>
    <div className="am-article-error-actions">{free && resource.downloadUrl ? <a className="am-button" href={resource.downloadUrl} download>Télécharger gratuitement le ZIP</a> : free ? <p>Ressource en préparation.</p> : <><Link className="am-button" href={offer}>Découvrir l’offre</Link><Link href="/nouveau/bibliotheque?onglet=suivi">Déjà acheté ? Mon suivi</Link></>}</div>
    <dl>{resource.metadata?.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    {safeArticleUrl(resource.coverUrl, { image: true }) && resource.coverAlt && <Image className="am-article-cover" src={resource.coverUrl} alt={resource.coverAlt} width={1200} height={800} sizes="(max-width: 930px) 90vw, 930px"/>}
    {resource.body?.length > 0 && <article className="am-article-body"><PortableText value={resource.body} components={components}/></article>}
  </main><Footer/></>;
}
