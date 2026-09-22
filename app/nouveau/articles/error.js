"use client";

import Link from "next/link";
import { Header, Footer } from "../_components/Shared";
import "./articles.css";

export default function ArticlesError({ reset }) {
  return <><Header /><main className="am-container am-articles">
    <p className="am-eyebrow">LE JOURNAL</p>
    <h1>Une petite <em>pause.</em></h1>
    <p className="am-articles-intro">Les articles sont momentanément indisponibles. Tu peux réessayer dans un instant.</p>
    <div className="am-article-error-actions"><button className="am-button" type="button" onClick={() => reset()}>Réessayer</button><Link href="/nouveau">Retour à l’accueil</Link></div>
  </main><Footer /></>;
}
