import Questionnaire from "../Questionnaire";

export const metadata = {
  title: "Questionnaire — Review de book — Animation Made",
};

export default async function ReviewQuestionnairePage({ searchParams }) {
  const query = await searchParams;
  const requestId = Array.isArray(query?.requestId) ? query.requestId[0] : query?.requestId;
  return <Questionnaire requestId={requestId || null} />;
}
