export const PROFILE_MUTABLE_FIELDS = Object.freeze([
  "name",
  "locale",
  "timezone",
  "consentVersion",
]);

const PROFILE_LIMITS = Object.freeze({
  name: 160,
  locale: 32,
  timezone: 80,
  consentVersion: 80,
});

export function filterProfilePatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  return PROFILE_MUTABLE_FIELDS.reduce((patch, field) => {
    const value = input[field];
    if (typeof value !== "string") return patch;
    const trimmed = value.trim();
    if (trimmed.length > PROFILE_LIMITS[field]) return patch;
    patch[field] = trimmed;
    return patch;
  }, {});
}
