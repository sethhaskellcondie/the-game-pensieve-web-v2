// A locally-unique id for a filter chip (for React keys and edit/remove
// targeting). Prefers crypto.randomUUID (browsers and modern Node/jsdom),
// falling back to a timestamp+random string.
export function newFilterId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `f-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}
