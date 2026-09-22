import Landing from "./nouveau/page";

export const metadata = {
  title: "Animation Made — faire de ton talent une vraie trajectoire",
  description:
    "Des cours et des retours personnalisés pour progresser en animation, construire ton showreel, apprendre en anglais et faire connaître ton travail.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function Home() {
  return (
    <div className="am-new">
      <Landing />
    </div>
  );
}
