import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText, Clock3, RefreshCw } from "lucide-react";
import { Header, Footer } from "../_components/Shared";
import EditorialHeading from "../_components/EditorialHeading";
import EditorialSections from "../_components/EditorialSections";
import { getEditorialPage } from "@/lib/sanity/content";
import { getPublishedPriceCatalog, publishedPrice } from "@/lib/pricing-server";

export const dynamic = "force-dynamic";

const fallbackMetadata = {
  title: "Review de book et showreel — Animation Made",
  description: "Un regard extérieur pour choisir tes projets, raconter ton parcours et donner envie de travailler avec toi.",
  alternates: { canonical: "/nouveau/review" },
};

export async function generateMetadata() {
  const page = await getEditorialPage("/nouveau/review");
  return {
    ...fallbackMetadata,
    title: page?.seo?.title || page?.title || fallbackMetadata.title,
    description: page?.seo?.description || page?.description || fallbackMetadata.description,
  };
}

export default async function Review() {
const price = publishedPrice(await getPublishedPriceCatalog(), "request:review");
const page = await getEditorialPage("/nouveau/review");
const hero = page?.hero || {};
return <><Header/><main className="am-container am-product am-review-page">
<Link className="am-back" href="/nouveau#programmes"><ArrowLeft size={16}/> Tous les programmes</Link>
<div className="am-product-grid"><div>
<p className="am-eyebrow">{hero.eyebrow}</p>
<EditorialHeading hero={hero}/>
<p className="am-lead">{hero.lead}</p>
<EditorialSections sections={page?.sections}/>
</div><aside className="am-booking-stack"><div className="am-booking"><span className="am-tag">SANS RENDEZ-VOUS EN VISIO</span><h2>Ta review<br/><em>personnalisée</em></h2>
<div className="am-price">{price.priceLabel}</div>
{price.version === 1 ? <p><em>Tarif de lancement valable jusqu’au 31 décembre 2026.</em></p> : null}
<p><FileText size={19}/>Un PDF personnalisé à conserver</p><p><Clock3 size={19}/>Sous 7 jours, dossier complet et payé</p><div className="am-review-bonus"><p className="am-eyebrow">BONUS DE LANCEMENT</p><h3><RefreshCw size={19}/> Ton deuxième retour offert</h3><p>Tu corriges ton book, tu me renvoies la nouvelle version et je te fais un retour ciblé sur les changements.</p></div>
<Link className="am-button" href="/nouveau/review/questionnaire">Commencer le questionnaire <ArrowUpRight size={18}/></Link>

</div></aside></div></main><Footer/></>;
}
