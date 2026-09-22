import Link from "next/link";
import { ArrowLeft, Film, Pencil, MessageSquare } from "lucide-react";
import { Header, Footer } from "../_components/Shared";
import EditorialHeading from "../_components/EditorialHeading";
import EditorialSections from "../_components/EditorialSections";
import { getEditorialPage } from "@/lib/sanity/content";

const fallbackMetadata = {
  title: "Feedback d’animation — Animation Made",
  description: "Un retour directement sur tes plans d’animation, avec des dessins sur les images et des commentaires précis pour guider tes corrections.",
  alternates: { canonical: "/nouveau/feedback" },
};

export async function generateMetadata() {
  const page = await getEditorialPage("/nouveau/feedback");
  return {
    ...fallbackMetadata,
    title: page?.seo?.title || page?.title || fallbackMetadata.title,
    description: page?.seo?.description || page?.description || fallbackMetadata.description,
  };
}

export default async function Feedback() {
  const page = await getEditorialPage("/nouveau/feedback");
  const hero = page?.hero || {};
  return <><Header/><main className="am-container am-product am-review-page">
    <Link className="am-back" href="/nouveau#programmes"><ArrowLeft size={16}/> Tous les programmes</Link>
    <div className="am-product-grid"><div>
      <p className="am-eyebrow">{hero.eyebrow}</p>
      <EditorialHeading hero={hero}/>
      <p className="am-lead">{hero.lead}</p>
      <EditorialSections sections={page?.sections}/>
      </div><aside className="am-booking-stack"><div className="am-booking"><span className="am-tag">UN RETOUR ANNOTÉ · SANS VISIO</span><h2>Ton feedback<br/><em>d’animation</em></h2><div className="am-price">38 €</div><p><em>Tarif de lancement valable jusqu’au 31 décembre 2026.</em></p><p><Film size={19}/>Jusqu’à 3 plans · 15 secondes cumulées</p><p><Pencil size={19}/>Dessins directement sur les images</p><p><MessageSquare size={19}/>Commentaires aux passages concernés</p><p>Un seul passage de correction.</p><Link className="am-button" href="/nouveau/feedback/questionnaire">Réserver mon feedback</Link></div>
      <div className="am-booking am-project-booking">
        <span className="am-tag">POUR ALLER PLUS LOIN · SANS VISIO</span>
        <h2>Ton projet<br/><em>d’animation</em></h2>
        <div className="am-price">88 €</div>
        <p><em>Tarif de lancement valable jusqu’au 31 décembre 2026.</em></p>
        <p>Un plan · 15 secondes maximum</p>
        <ol className="am-review-choices">
          <li>Un document de préparation personnalisé et illustré.</li>
          <li>Une première review sur ton animation.</li>
          <li>Une deuxième review après tes corrections.</li>
        </ol>
        <p>Préparation et chaque review sous 7 jours maximum après réception des éléments correspondants. Tu avances à ton rythme entre les envois.</p>
        <Link className="am-button" href="/nouveau/feedback/projet/questionnaire">Réserver mon projet</Link>
      </div>
    </aside></div>
  </main><Footer/></>;
}
