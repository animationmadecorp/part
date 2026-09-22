import ProjectQuestionnaire from "./questionnaire";
export const metadata = { title: "Ton projet d’animation — Animation Made" };
export default async function Page({ searchParams }) {
  const query = await searchParams;
  const requestId = Array.isArray(query?.requestId) ? query.requestId[0] : query?.requestId;
  return <ProjectQuestionnaire requestId={requestId || null} />;
}
