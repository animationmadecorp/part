import Link from "next/link";
import { Film, GalleryHorizontalEnd, Globe2, Sparkles } from "lucide-react";
import { Header, Footer } from "./_components/Shared";
import PageRibbon from "./_components/PageRibbon";
import EditorialHeading from "./_components/EditorialHeading";
import EditorialSections from "./_components/EditorialSections";
import { getPublicEditorialContent } from "@/lib/sanity/content";

const fallbackMetadata = {
  title: "Animation Made — faire de ton talent une vraie trajectoire",
  description:
    "Des cours et une documentation faite sur-mesure pour progresser en animation, construire ton showreel, améliorer ton anglais spécifiquement dans ces disciplines ou faire connaître ton travail sur les réseaux.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export async function generateMetadata() {
  const editorial = await getPublicEditorialContent();
  const page = editorial.pages.find((item) => item.slug === "/nouveau");
  return {
    ...fallbackMetadata,
    title: page?.seo?.title || page?.title || fallbackMetadata.title,
    description: page?.seo?.description || page?.description || fallbackMetadata.description,
  };
}

const icons = { film: Film, frames: GalleryHorizontalEnd, globe: Globe2, sparkles: Sparkles };
const linkedOffers = new Set(["feedback", "review", "visibilite", "anglais"]);

export default async function Home() {
const editorial = await getPublicEditorialContent();
const home = editorial.pages.find((page) => page.slug === "/nouveau");
const hero = home?.hero || {};
const offers = editorial.offers;
return <><Header/><main className="am-ribbon-page"><PageRibbon/>
<section className="am-hero am-container">
<div className="am-hero-copy"><p className="am-eyebrow">{hero.eyebrow}</p><EditorialHeading hero={hero}/><p className="am-lead">{hero.lead}</p><div className="am-hero-actions"><Link className="am-button" href="#programmes">Découvrir les offres</Link><Link className="am-button am-outline" href="#cadeaux">Découvrir les add-ons Blender gratuits</Link></div></div>
</section>
<EditorialSections sections={home?.sections} styles={["bio"]}/>
<div className="am-ribbon-gap" aria-hidden="true"/>
<EditorialSections sections={home?.sections} styles={["gift"]}/>
<EditorialSections sections={home?.sections} styles={["default", "feature", "prose", "cards", "steps", "list"]}/>
<div className="am-ribbon-gap" aria-hidden="true"/>
<section id="programmes" className="am-section am-container"><div className="am-section-head"><div><p className="am-eyebrow">CE QUE JE TRANSMETS</p><h2>Les cours<br/><em>et les reviews.</em></h2></div></div><div className="am-offers">{offers.map(offer=>{
  const Icon=icons[offer.icon];
  const linked=linkedOffers.has(offer.slug);
  const Card=linked ? Link : "article";
  return <Card key={offer.slug} className={"am-offer am-"+offer.color} {...(linked ? {href:"/nouveau/"+offer.slug, "aria-label":"Découvrir l’offre : "+offer.category} : {})}>
    <div className="am-offer-top">{Icon ? <Icon size={30}/> : <Sparkles size={30}/>}<span>{offer.number}</span></div>
    <p className="am-eyebrow">{offer.category}</p><h3>{offer.title}</h3><p>{offer.description}</p>
    {linked && <span className="am-offer-cta">Découvrir l’offre</span>}
  </Card>;
})}</div></section>
<div className="am-ribbon-gap" aria-hidden="true"/>
<EditorialSections sections={home?.sections} styles={["problems"]}/>
</main><Footer/></>;
}
