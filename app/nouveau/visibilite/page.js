import Link from "next/link";
import { ArrowLeft, ClipboardList, FileText } from "lucide-react";
import { Header, Footer } from "../_components/Shared";
import EditorialHeading from "../_components/EditorialHeading";
import EditorialSections from "../_components/EditorialSections";
import { getEditorialPage } from "@/lib/sanity/content";
import { getPublishedPriceCatalog, publishedPrice } from "@/lib/pricing-server";

export const dynamic = "force-dynamic";

const fallbackMetadata = {
  title: "Te faire connaître sur les réseaux — Animation Made",
  description: "Un questionnaire approfondi et une fiche personnalisée : fil rouge, valeurs, public, idées de contenus et pistes pour vivre de ton art. Sans visio.",
  alternates: { canonical: "/nouveau/visibilite" },
};

export async function generateMetadata() {
  const page = await getEditorialPage("/nouveau/visibilite");
  return {
    ...fallbackMetadata,
    title: page?.seo?.title || page?.title || fallbackMetadata.title,
    description: page?.seo?.description || page?.description || fallbackMetadata.description,
  };
}

export default async function Visibilite() {
  const price = publishedPrice(await getPublishedPriceCatalog(), "request:contenu");
  const page = await getEditorialPage("/nouveau/visibilite");
  const hero = page?.hero || {};
  return <><Header/><main className="am-container am-product am-review-page">
    <Link className="am-back" href="/nouveau#programmes"><ArrowLeft size={16}/> Tous les programmes</Link>
    <div className="am-product-grid">
      <div>
        <p className="am-eyebrow">{hero.eyebrow}</p>
        <EditorialHeading hero={hero}/>
        <p className="am-lead">{hero.lead}</p>

        <EditorialSections sections={page?.sections}/>
      </div>
      <aside className="am-booking-stack">
        <div className="am-booking">
          <span className="am-tag">FICHE PERSONNALISÉE · SANS VISIO</span>
          <h2>Ta direction<br/><em>de contenu</em></h2>
          <div className="am-price">{price.priceLabel}</div>
          <p><ClipboardList size={19}/>Un questionnaire approfondi avec liens et pièces jointes</p>
          <p><FileText size={19}/>Une fiche personnalisée à conserver</p>
          <p><em>Livraison sous 10 jours maximum après réception de ton questionnaire complet et des pièces jointes. Si un imprévu décale ce délai, tu es prévenu·e.</em></p>
          <ul className="am-review-choices"><li>Fil rouge, valeurs et forces.</li><li>Point de vue, public et idées de contenus.</li><li>Pistes pour vivre de ton art.</li></ul>
          <Link className="am-button" href="/nouveau/visibilite/questionnaire">Commencer mon questionnaire</Link>
        </div>
      </aside>
    </div>
  </main><Footer/></>;
}
