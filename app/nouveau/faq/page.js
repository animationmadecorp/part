import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Header, Footer } from "../_components/Shared";
import { getEditorialFaq } from "@/lib/sanity/content";

export const metadata = {
  title: "Questions fréquentes — Animation Made",
  description: "Les réponses aux questions fréquentes sur les accompagnements Animation Made.",
  alternates: { canonical: "/nouveau/faq" },
};

export default async function FaqPage() {
  const faq = await getEditorialFaq();
  const items = faq?.items || [];

  return <><Header/><main className="am-container am-product am-review-page">
    <Link className="am-back" href="/nouveau#programmes"><ArrowLeft size={16}/> Tous les programmes</Link>
    <div className="am-product-grid"><div>
      <p className="am-eyebrow">AVANT DE COMMENCER</p>
      <h1>Questions<br/><em>fréquentes.</em></h1>
      <p className="am-lead">Les informations essentielles sur les formats et les accompagnements Animation Made.</p>
      <section className="am-product-art am-review-submission am-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">{faq?.title || "Questions fréquentes"}</h2>
        {items.length ? items.map((item) => <details className="am-faq" key={item.stableId || item.question}>
          <summary className="am-faq-q">{item.question}</summary>
          <div className="am-faq-a"><p>{item.answer}</p></div>
        </details>) : <p>Les réponses seront ajoutées avant l’ouverture au public.</p>}
      </section>
    </div></div>
  </main><Footer/></>;
}
