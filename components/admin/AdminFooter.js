import Link from "next/link";

// Footer for the admin area: logout lives here (in the footer), not in the header.
// One logout for everyone now — it clears the editor + site session properly.
export default function AdminFooter() {
  return (
    <footer className="border-t border-line mt-12">
      <div className="mx-auto max-w-3xl w-full px-5 py-6 flex items-center justify-between gap-4 text-sm" style={{ color: "#7C7488" }}>
        <Link href="/nouveau" className="hover:text-accent">← Retour au site</Link>
      </div>
    </footer>
  );
}
