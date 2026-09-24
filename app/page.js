import Landing from "./nouveau/page";
import { SITE_ORIGIN } from "@/lib/seo";

const title = "Animation Made — faire de ton talent une vraie trajectoire";
const description =
  "Des cours et des retours personnalisés pour progresser en animation, construire ton showreel, apprendre en anglais et faire connaître ton travail.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "fr_FR", siteName: "Animation Made", url: "/", title, description },
  twitter: { card: "summary", title, description },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Animation Made",
  url: SITE_ORIGIN,
  inLanguage: "fr-FR",
  description,
};

export default function Home() {
  return (
    <div className="am-new">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }}
      />
      <Landing />
    </div>
  );
}
