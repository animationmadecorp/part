export function createPrePaymentState(values = {}) {
  return { step: "form", ...values };
}

export function prePaymentReducer(state, action) {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.values };
    case "show_recap":
      return { ...state, step: "recap" };
    case "edit":
      return { ...state, step: "form" };
    default:
      return state;
  }
}

export function isNonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function requiredFieldMessage(value, message) {
  return isNonBlank(value) ? "" : message;
}

export function paymentLabel(priceLabel) {
  return `Payer ${String(priceLabel).replace(/\s+le pack$/i, "")}`;
}
