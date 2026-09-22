import LegalPage from "../_components/LegalPage";
import { businessIdentity } from "../_data/legal";

export const metadata = { title: "Contact — Animation Made", description: "Contacter Animation Made au sujet d’une offre, d’une commande ou de ses données personnelles.", alternates: { canonical: "/nouveau/contact" } };

export default function ContactPage() {
  return <LegalPage eyebrow="UNE QUESTION ?" title={<>Parlons de <em>ton projet.</em></>} intro="Une question avant de réserver, un problème avec une commande ou besoin d’exercer un droit sur tes données : utilise les coordonnées ci-dessous.">
    <section><h2>Contacter Animation Made</h2><div className="am-contact-cards"><a href={`mailto:${businessIdentity.email}`}><span>E-mail</span><strong>{businessIdentity.email}</strong></a><a href={`tel:${businessIdentity.phoneHref}`}><span>Téléphone</span><strong>{businessIdentity.phoneLabel}</strong></a></div><p>Pour que je puisse retrouver rapidement ta demande, indique l’adresse e-mail utilisée lors de la commande et, si tu en as un, le numéro de commande. N’envoie jamais de données bancaires par e-mail.</p></section>
    <section><h2>Adresse professionnelle</h2><p>{businessIdentity.owner}<br/>{businessIdentity.address}</p></section>
    <section><h2>Une réclamation ?</h2><p>Écris d’abord à <a href={`mailto:${businessIdentity.email}`}>{businessIdentity.email}</a> en expliquant la difficulté rencontrée. Je chercherai une solution avec toi et te répondrai dans les meilleurs délais.</p></section>
  </LegalPage>;
}
