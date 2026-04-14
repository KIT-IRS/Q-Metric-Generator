// ─── Intent state colors & descriptions ───────────────────────────────────
// Edit descriptions and Tailwind color classes here without touching component code.
export const INTENT_CONFIG: Record<string, { color: string; description: string }> = {
  actual:       { color: "text-emerald-600", description: "Confirmed, verified real-world data" },
  generated:    { color: "text-blue-600",    description: "System or algorithm generated value" },
  placeholder:  { color: "text-gray-500",    description: "Temporary placeholder, pending real data" },
  default:      { color: "text-slate-600",   description: "Default value from the model definition" },
  hypothetical: { color: "text-violet-600",  description: "Theoretical or assumed value" },
  invalid:      { color: "text-orange-600",  description: "Confirmed as null – no value exists" },
  outdated:     { color: "text-red-600",     description: "Previously valid but no longer current" },
  "null/empty": { color: "text-gray-400",    description: "No value has been set" },
};

// ─── Value attribute descriptions ─────────────────────────────────────────
// Maps the exact string value of the "value" attribute to a color dot + description.
// Add more entries here as new value options are introduced in the AML.
export const VALUE_CONFIG: Record<string, { dotColor: string; description: string }> = {
  "not available":          { dotColor: "bg-red-500",     description: "The aspect is absent or completely undocumented" },
  "occasionally available": { dotColor: "bg-orange-400",  description: "The aspect is available only in exceptional cases" },
  "mostly available":       { dotColor: "bg-yellow-400",  description: "The aspect is available in most cases" },
  "generally available":    { dotColor: "bg-emerald-500", description: "The aspect is fully and consistently available" },
  // traffic-light shorthand
  "red":    { dotColor: "bg-red-500",     description: "Not documented / not fulfilled" },
  "yellow": { dotColor: "bg-yellow-400",  description: "Partially documented / partially fulfilled" },
  "green":  { dotColor: "bg-emerald-500", description: "Completely documented / fully fulfilled" },
};

// ─── Mode reminder texts ───────────────────────────────────────────────────
// The instructional text shown to the user in each mode.
export const MODE_REMINDERS = {
  weight:     "How important do you weight the following aspects?",
  evaluation: "How do you evaluate the following aspects?",
  scores:     "Overview of scores across all editors.",
};

// ─── Evaluation mode editor ID ────────────────────────────────────────────
// Fixed editor used when the app is in Evaluation mode (no selector shown).
export const EVALUATION_MODE_EDITOR_ID = "default";
