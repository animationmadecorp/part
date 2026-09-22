import localFont from "next/font/local";
import "./globals.css";
import "./nouveau/nouveau.css";
import SmoothScroll from "@/components/SmoothScroll";
import IframeChrome from "@/components/IframeChrome";
import AuthProviders from "@/components/AuthProviders";
import { SITE_ORIGIN } from "@/lib/seo";

const poppins = localFont({
  src: [
    { path: "./fonts/poppins-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const caveat = localFont({
  src: [
    { path: "./fonts/caveat-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/caveat-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/caveat-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Animation Made — faire de ton talent une vraie trajectoire",
  description:
    "Des cours et des retours personnalisés pour progresser en animation, construire ton showreel, apprendre en anglais et faire connaître ton travail.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${poppins.variable} ${caveat.variable}`}
    >
      <body className="min-h-screen">
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <AuthProviders>
          <SmoothScroll />
          <IframeChrome />
          {children}
        </AuthProviders>
      </body>
    </html>
  );
}
