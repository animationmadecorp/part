import Link from "next/link";
import { Header, Footer } from "../_components/Shared";
import { getPublishedArticles } from "@/lib/sanity/articles";
import "./articles.css";

export const metadata = { title: "Articles — Animation Made", description: "Conseils et réflexions sur les métiers de l’animation.", alternates: { canonical: "/nouveau/articles" } };
export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();
  return <><Header /><main className="am-container am-articles">
    <p className="am-eyebrow">LE JOURNAL</p><h1>Les <em>articles.</em></h1>
    <p className="am-articles-intro">Des idées et des repères pour avancer dans l’animation, à ton rythme.</p>
    {articles.length ? <div className="am-article-list">{articles.map((article) => <Link className="am-article-card" href={`/nouveau/articles/${article.slug}`} key={article._id}>
      <p className="am-eyebrow">{article.category || "Article"}</p><h2>{article.title}</h2><p>{article.summary}</p>
    </Link>)}</div> : <p className="am-article-empty">Les articles arrivent bientôt.</p>}
  </main><Footer /></>;
}
