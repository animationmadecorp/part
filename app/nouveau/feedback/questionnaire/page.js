import FeedbackQuestionnaire from "./questionnaire";

export const metadata = { title: "Ton feedback d’animation — Animation Made" };

export default async function Page({ searchParams }) {
  const query = await searchParams;
  const requestId = Array.isArray(query?.requestId) ? query.requestId[0] : query?.requestId;
  return <FeedbackQuestionnaire requestId={requestId || null} />;
}
