import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { Header, Footer } from "../../_components/Shared";
import { getPublishedArticle } from "@/lib/sanity/articles";
import { safeArticleUrl } from "@/lib/sanity/article-core.mjs";
import "../articles.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Article introuvable — Animation Made", robots: { index: false } };
  return { title: `${article.title} — Animation Made`, description: article.summary, alternates: { canonical: `/nouveau/articles/${slug}` }, openGraph: { title: article.title, description: article.summary, images: article.coverUrl ? [{ url: article.coverUrl, alt: article.coverAlt }] : [] } };
}

const components = {
  marks: { link: ({ value, children }) => { const href = safeArticleUrl(value?.href); return href ? <a href={href} rel="noopener noreferrer">{children}</a> : <>{children}</>; } },
  types: { image: ({ value }) => { const url = safeArticleUrl(value?.url, { image: true }); return url && value?.alt ? <Image src={url} alt={value.alt} width={1200} height={800} sizes="(max-width: 930px) 90vw, 930px" /> : null; } },
};

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  if (slug === "am-light") permanentRedirect("/nouveau/ressources/scene-light");
  const article = await getPublishedArticle(slug);
  if (!article) notFound();
  return <><Header /><main className="am-container am-articles">
    <Link className="am-back" href="/nouveau/articles">← Tous les articles</Link>
    <p className="am-eyebrow">{article.category || "Article"}</p><h1>{article.title}</h1>
    <p className="am-articles-intro">{article.summary}</p>
    {article.publishedAt && <p className="am-article-date">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(article.publishedAt))}</p>}
    {article.coverUrl && article.coverAlt && <Image className="am-article-cover" src={article.coverUrl} alt={article.coverAlt} width={1200} height={675} sizes="(max-width: 930px) 90vw, 930px" priority />}
    <article className="am-article-body"><PortableText value={article.body} components={components} /></article>
  </main><Footer /></>;
}
