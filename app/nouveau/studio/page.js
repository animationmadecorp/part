import ReviewStudio from "../../../components/ReviewStudio";
import Link from "next/link";
import "./studio.css";
import AccessBoundary from "../_components/AccessBoundary";
import { requireAdminPage } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const access = await requireAdminPage();
  if (!access.ok) return <AccessBoundary reason={access.reason}/>;

  const query = await searchParams;
  const requestId = typeof query?.requestId === "string" ? query.requestId : null;
  const sourceFileId = typeof query?.sourceFileId === "string"
    ? query.sourceFileId
    : (typeof query?.planId === "string" ? query.planId : null);
  const cycleNumber = Number(query?.cycle);
  const selectedCycle = Number.isInteger(cycleNumber) && cycleNumber >= 1 && cycleNumber <= 2 ? cycleNumber : 1;
  const returnHref = requestId ? `/nouveau/demandes?requestId=${encodeURIComponent(requestId)}` : "/nouveau/demandes";
  return <main className="am-correction-studio">
    <Link className="am-studio-back" href={returnHref}>← Retour aux demandes</Link>
    <header><div><p className="am-eyebrow">Espace de correction</p><h1>Ton studio de <em>review.</em></h1><p>Dessine sur la vidéo privée du dossier et laisse tes commentaires au bon moment.</p></div>{requestId && <aside className="am-studio-context" aria-label="Dossier sélectionné"><span>Dossier sélectionné</span><strong>Commande payée</strong><small>Les informations sont chargées depuis Convex.</small></aside>}</header>
    {!requestId && <p className="am-studio-context-warning" role="status">Ouvre une demande payée depuis la liste des dossiers pour associer sa vidéo.</p>}
    <ReviewStudio maxSeconds={15} persist requestId={requestId} sourceFileId={sourceFileId} cycleNumber={selectedCycle} requestContext={requestId ? { requestId, sourceFileId, returnHref } : null}/>
  </main>;
}
