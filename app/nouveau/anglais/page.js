import Link from "next/link";
import { ArrowLeft, Clock3, UserRound, UsersRound, Video } from "lucide-react";
import { Header, Footer } from "../_components/Shared";
import EditorialHeading from "../_components/EditorialHeading";
import EditorialSections from "../_components/EditorialSections";
import { getEditorialPage } from "@/lib/sanity/content";

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
  const page = await getEditorialPage("/nouveau/anglais");
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
          <span className="am-tag">COURS PARTICULIER</span>
          <h2>L’anglais<br/><em>à ton rythme</em></h2>
          <div className="am-price">55 €</div>
          <p><Clock3 size={19}/>Une heure de cours</p>
          <p><UserRound size={19}/>Un cours individuel sur mesure</p>
          <p><Video size={19}/>En visioconférence</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=solo">Réserver mon cours</Link>
        </div>
        <div className="am-booking am-project-booking">
          <span className="am-tag">PACK INDIVIDUEL · 4 HEURES</span>
          <h2>Installer<br/><em>une régularité</em></h2>
          <div className="am-price">200 €</div>
          <p><Clock3 size={19}/>4 cours individuels d’une heure</p>
          <p><strong>50 € par cours · 20 € économisés</strong></p>
          <p><em>4 heures à utiliser dans les 3 mois suivant l’achat.</em></p>
          <p><em>Par rapport à quatre cours à l’unité à 55 €.</em></p>
          <p>Leçons complémentaires et GPT d’entraînement inclus.</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=solo-4h">Réserver mes 4 heures</Link>
        </div>
        <div className="am-booking am-project-booking">
          <span className="am-tag">PACK INDIVIDUEL · 8 HEURES</span>
          <h2>Pratiquer<br/><em>dans la durée</em></h2>
          <div className="am-price">360 €</div>
          <p><Clock3 size={19}/>8 cours individuels d’une heure</p>
          <p><strong>45 € par cours · 80 € économisés</strong></p>
          <p><em>8 heures à utiliser dans les 6 mois suivant l’achat.</em></p>
          <p><em>Par rapport à huit cours à l’unité à 55 €.</em></p>
          <p>Leçons complémentaires et GPT d’entraînement inclus.</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=solo-8h">Réserver mes 8 heures</Link>
        </div>
        <div className="am-booking am-project-booking">
          <span className="am-tag">COURS EN DUO</span>
          <h2>Apprendre<br/><em>avec un ami</em></h2>
          <div className="am-price">68 €</div>
          <p><strong>Pour deux, soit 34 € par personne.</strong></p>
          <p><Clock3 size={19}/>Une heure de cours ensemble</p>
          <p><UsersRound size={19}/>Vous venez avec votre binôme</p>
          <p><Video size={19}/>En visioconférence</p>
          <Link className="am-button" href="/nouveau/reserver?offre=anglais&format=duo">Réserver notre cours</Link>
        </div>
      </aside>
    </div>
  </main><Footer/></>;
}
