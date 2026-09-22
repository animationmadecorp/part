import LegalPage from "../_components/LegalPage";
import { businessIdentity, hostingProvider } from "../_data/legal";

export const metadata = { title: "Mentions légales — Animation Made", description: "Identité de l’éditrice et informations légales du site Animation Made.", alternates: { canonical: "/nouveau/mentions-legales" } };

export default function LegalNoticesPage() {
  return <LegalPage eyebrow="INFORMATIONS LÉGALES" title={<>Mentions <em>légales.</em></>} intro="Les informations permettant d’identifier l’éditrice, la directrice de publication et l’hébergeur du site.">
    <section><h2>Édition du site</h2><dl className="am-legal-data"><div><dt>Nom commercial</dt><dd>{businessIdentity.brand}</dd></div><div><dt>Éditrice</dt><dd>{businessIdentity.owner}, {businessIdentity.legalForm.toLowerCase()}</dd></div><div><dt>SIRET</dt><dd>{businessIdentity.siret}</dd></div><div><dt>Adresse</dt><dd>{businessIdentity.address}</dd></div><div><dt>E-mail</dt><dd><a href={`mailto:${businessIdentity.email}`}>{businessIdentity.email}</a></dd></div><div><dt>Téléphone</dt><dd><a href={`tel:${businessIdentity.phoneHref}`}>{businessIdentity.phoneLabel}</a></dd></div><div><dt>TVA</dt><dd>{businessIdentity.vat}</dd></div></dl></section>
    <section><h2>Direction de la publication</h2><p>La directrice de la publication est {businessIdentity.owner}.</p></section>
    <section><h2>Hébergement</h2><p>Le site est hébergé par {hostingProvider.name}, {hostingProvider.address}. Site : <a href={hostingProvider.website} target="_blank" rel="noreferrer">vercel.com</a>.</p></section>
    <section><h2>Propriété intellectuelle</h2><p>Les textes, supports pédagogiques, analyses, documents personnalisés, illustrations, éléments graphiques et autres contenus publiés par Animation Made sont protégés par le droit de la propriété intellectuelle. Ils sont réservés à un usage personnel, sauf autorisation écrite préalable.</p><p>Les travaux transmis par les clients restent leur propriété. Leur transmission autorise uniquement leur consultation et leur traitement pour exécuter la prestation commandée.</p></section>
    <section><h2>Signaler un problème</h2><p>Pour signaler un contenu, une erreur ou une atteinte à un droit, écris à <a href={`mailto:${businessIdentity.email}`}>{businessIdentity.email}</a>.</p></section>
  </LegalPage>;
}
