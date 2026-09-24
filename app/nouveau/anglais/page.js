import Link from "next/link";
import { ArrowLeft, Clock3, UserRound, UsersRound, Video } from "lucide-react";
import { Header, Footer } from "../_components/Shared";
import EditorialHeading from "../_components/EditorialHeading";
import EditorialSections from "../_components/EditorialSections";
import { getEditorialPage } from "@/lib/sanity/content";
import { getPublishedPriceCatalog, publishedPrice } from "@/lib/pricing-server";

function packComparison(pack, single, count) {
  const perCourse = `${pack.priceCents % count ? "environ " : ""}${(pack.priceCents / count / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`;
  const savingsCents = single.priceCents * count - pack.priceCents;
  return {
    perCourse,
    savings: savingsCents > 0 ? `${(savingsCents / 100).toLocaleString("fr-FR")} € économisés` : null,
  };
}

export const dynamic = "force-dynamic";

const fallbackMetadata = {
  title: "Cours d’anglais pour les artistes — Animation Made",
  description: "Comprendre et parler anglais avec des cours sur mesure autour de l’animation. En individuel ou à deux avec un ami, en visio.",
  alternates: { canonical: "/nouveau/anglais" },
};

export async function generateMetadata() {
  const page = await getEditorialPage("/nouveau/anglais");
  return {
    ...fallbackMetadata,
    title: page?.seo?.title || page?.title || fallbackMetadata.title,
    description: page?.seo?.description || page?.description || fallbackMetadata.description,
  };
}

export default async function Anglais() {
  const catalog = await getPublishedPriceCatalog();
  const solo = publishedPrice(catalog, "booking:anglais:solo");
  const four = publishedPrice(catalog, "booking:anglais:solo-4h");
  const eight = publishedPrice(catalog, "booking:anglais:solo-8h");
  const duo = publishedPrice(catalog, "booking:anglais:duo");
  const fourComparison = packComparison(four, solo, 4);
  const eightComparison = packComparison(eight, solo, 8);
  const page = await getEditorialPage("/nouveau/anglais");
  const hero = page?.hero || {};
  const sections = page?.sections?.map((section) => {
    if (section.stableId === "section:english-practice") {
      return {
        ...section,
        items: section.items.map((item) => item.stableId === "english:practice-lessons"
          ? { ...item, body: "Dès ton premier cours acheté, tu accèdes aux leçons complémentaires de Made pour pratiquer entre les séances." }
          : item),
      };
    }
    if (section.stableId === "section:english-reschedule") {
      return {
        ...section,
        body: "Pour demander un report, contacte-moi au moins 24 heures avant le rendez-vous. À moins de 24 heures ou en cas d’absence, la séance est décomptée, sauf exception que je t’accorde.",
      };
    }
    return section;
  });
  return <><Header/><main className="am-container am-product am-review-page">
    <Link className="am-back" href="/nouveau#programmes"><ArrowLeft size={16}/> Tous les programmes</Link>
    <div className="am-product-grid">
      <div>
        <p className="am-eyebrow">{hero.eyebrow}</p>
        <EditorialHeading hero={hero}/>
        <p className="am-lead">{hero.lead}</p>

        <EditorialSections sections={sections}/>
      </div>

      <aside className="am-booking-stack">
        <div className="am-booking">
          <span className="am-tag">COURS PARTICULIER</span>
          <h2>L’anglais<br/><em>à ton rythme</em></h2>
          <div className="am-price">{solo.priceLabel}</div>
          <p><Clock3 size={19}/>Une heure de cours</p>
          <p><UserRound size={19}/>Un cours individuel sur mesure</p>
          <p><Video size={19}/>En visioconférence</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=solo">Réserver mon cours</Link>
        </div>
        <div className="am-booking am-project-booking">
          <span className="am-tag">PACK INDIVIDUEL · 4 HEURES</span>
          <h2>Installer<br/><em>une régularité</em></h2>
          <div className="am-price">{four.priceLabel.replace(/ le pack$/, "")}</div>
          <p><Clock3 size={19}/>4 cours individuels d’une heure</p>
          <p><strong>{fourComparison.perCourse} € par cours{fourComparison.savings ? ` · ${fourComparison.savings}` : ""}</strong></p>
          <p><em>4 heures à utiliser dans les 3 mois suivant l’achat.</em></p>
          {fourComparison.savings ? <p><em>Par rapport à quatre cours à l’unité à {solo.priceLabel}.</em></p> : null}
          <p>Leçons complémentaires incluses dès ton premier cours.</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=solo-4h">Réserver mes 4 heures</Link>
        </div>
        <div className="am-booking am-project-booking">
          <span className="am-tag">PACK INDIVIDUEL · 8 HEURES</span>
          <h2>Pratiquer<br/><em>dans la durée</em></h2>
          <div className="am-price">{eight.priceLabel.replace(/ le pack$/, "")}</div>
          <p><Clock3 size={19}/>8 cours individuels d’une heure</p>
          <p><strong>{eightComparison.perCourse} € par cours{eightComparison.savings ? ` · ${eightComparison.savings}` : ""}</strong></p>
          <p><em>8 heures à utiliser dans les 6 mois suivant l’achat.</em></p>
          {eightComparison.savings ? <p><em>Par rapport à huit cours à l’unité à {solo.priceLabel}.</em></p> : null}
          <p>Leçons complémentaires incluses dès ton premier cours.</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=solo-8h">Réserver mes 8 heures</Link>
        </div>
        <div className="am-booking am-project-booking">
          <span className="am-tag">COURS EN DUO</span>
          <h2>Apprendre<br/><em>avec un ami</em></h2>
          <div className="am-price">{duo.priceLabel}</div>
          <p><strong>Pour deux, soit {duo.priceCents % 2 ? "environ " : ""}{(duo.priceCents / 2 / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € par personne.</strong></p>
          <p><Clock3 size={19}/>Une heure de cours ensemble</p>
          <p><UsersRound size={19}/>Vous venez avec votre binôme</p>
          <p><Video size={19}/>En visioconférence</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=duo">Réserver notre cours</Link>
        </div>
      </aside>
    </div>
  </main><Footer/></>;
}
