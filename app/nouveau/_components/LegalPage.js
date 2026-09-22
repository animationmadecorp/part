import Link from "next/link";
import { Footer, Header } from "./Shared";
import { legalUpdatedAt } from "../_data/legal";

export default function LegalPage({ eyebrow, title, intro, children }) {
  return <>
    <Header />
    <main className="am-legal-page am-container">
      <header className="am-legal-heading">
        <p className="am-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {intro && <p className="am-lead">{intro}</p>}
        <p className="am-legal-date">Dernière mise à jour : {legalUpdatedAt}</p>
      </header>
      <div className="am-legal-layout">
        <article className="am-legal-content">{children}</article>
        <aside className="am-legal-aside">
          <p className="am-eyebrow">À consulter aussi</p>
          <nav aria-label="Autres informations légales">
            <Link href="/nouveau/mentions-legales">Mentions légales</Link>
            <Link href="/nouveau/confidentialite">Confidentialité</Link>
            <Link href="/nouveau/cgv">Conditions générales de vente</Link>
            <Link href="/nouveau/remboursements">Rétractation et remboursements</Link>
            <Link href="/nouveau/contact">Contact</Link>
          </nav>
        </aside>
      </div>
    </main>
    <Footer />
  </>;
}
