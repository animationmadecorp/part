export const contentOffer = {
  name: "Ta direction de contenu",
  price: 58,
  priceLabel: "58 €",
  launchPriceEnd: "31 décembre 2026",
};

export function createQuestionnaireState(answerCount) {
  return {
    answers: Array(answerCount).fill(""),
    files: [],
    step: "questionnaire",
  };
}

export function questionnaireReducer(state, action) {
  switch (action.type) {
    case "reset_draft":
      return {
        answers: Array.isArray(action.answers) ? action.answers : Array(state.answers.length).fill(""),
        files: [],
        step: "questionnaire",
      };
    case "restore_answers":
      return { ...state, answers: action.answers };
    case "update_answer":
      return {
        ...state,
        answers: state.answers.map((answer, index) =>
          index === action.index ? action.value : answer,
        ),
      };
    case "add_files":
      return {
        ...state,
        files: [
          ...state.files,
          ...action.files.filter(
            (file) =>
              !state.files.some(
                (item) =>
                  item.name === file.name &&
                  item.size === file.size &&
                  item.lastModified === file.lastModified,
              ),
          ),
        ],
      };
    case "remove_file":
      return {
        ...state,
        files: state.files.filter((_, index) => index !== action.index),
      };
    case "remove_matching_file":
      return {
        ...state,
        files: state.files.filter((file) => !(file.name === action.file.name && Number(file.size) === Number(action.file.size))),
      };
    case "show_recap":
      return { ...state, step: "recap" };
    case "edit_answers":
      return { ...state, step: "questionnaire" };
    default:
      return state;
  }
}

export function isRequiredAnswerValid(answer) {
  return typeof answer === "string" && answer.trim().length > 0;
}
