import ContentQuestionnaire from "./questionnaire";

export const metadata = { title: "Questionnaire contenu — Animation Made" };

export default async function Page({ searchParams }) {
  const query = await searchParams;
  const requestId = Array.isArray(query?.requestId) ? query.requestId[0] : query?.requestId;
  return <ContentQuestionnaire requestId={requestId || null} />;
}
