import Library from "./Library";
import AccessBoundary from "../_components/AccessBoundary";
import { requireConnectedMemberPage } from "@/lib/server-auth";
import { getPublicEditorialContent } from "@/lib/sanity/content";

export const dynamic = "force-dynamic";

export default async function Page({searchParams}) {
 const access = await requireConnectedMemberPage();
 if (!access.ok) return <AccessBoundary reason={access.reason}/>;
 const p=await searchParams;
 const editorial = await getPublicEditorialContent();
 const requestedFollowUp = ["anglais", "animation", "feedback", "book", "contenu"].includes(p.suivi) ? p.suivi : null;
 const requestedRequestId = typeof p.requestId === "string" ? p.requestId : null;
 const requestedEnglishLesson = typeof p.lecon === "string" ? p.lecon : null;
 return <Library resources={editorial.resources} isAdmin={access.profile?.role === "admin"} initialTab={p.onglet==="suivi"?"Mon suivi":p.onglet==="compte"?"Mon compte":p.onglet==="tableau-de-bord"?"Tableau de bord":"Ma bibliothèque"} initialFollowUp={requestedFollowUp} initialRequestId={requestedRequestId} initialEnglishLesson={requestedEnglishLesson}/>;
}
