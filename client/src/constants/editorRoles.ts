/**
 * Editor roles configuration
 * Easily adjustable by modifying the EDITOR_ROLES array
 */

export interface EditorRole {
  id: string;
  displayName: string;
}

export const EDITOR_ROLES: EditorRole[] = [
  { id: "default", displayName: "Default" },
  { id: "modelling_engineer", displayName: "Modelling Engineer" },
  { id: "internal_reviewer", displayName: "Internal Reviewer" },

  { id: "internal_user", displayName: "Internal User" },
  {
    id: "external_system_integrator",
    displayName: "3rd Party System Integrator",
  },
  { id: "platform_operator", displayName: "Platform Operator" },
  { id: "model_user", displayName: "Model User" },
];

/**
 * Intent Semantics state machine configuration
 * Modify the TRANSITION_MATRIX to change which transitions are allowed.
 */

export const INTENT_SEMANTICS_STATES = [
  "null/empty",
  "generated",
  "placeholder",
  "default",
  "hypothetical",
  "invalid",
  "actual",
  "outdated",
] as const;

export type IntentSemanticsState = (typeof INTENT_SEMANTICS_STATES)[number];

// Each key maps to the list of states it CAN transition to
export const TRANSITION_MATRIX: Record<
  IntentSemanticsState,
  IntentSemanticsState[]
> = {
  "null/empty": [
    "generated",
    "placeholder",
    "default",
    "hypothetical",
    "invalid",
  ],
  generated: [
    "actual",
    "placeholder",
    "default",
    "outdated",
    "hypothetical",
    "null/empty",
  ],
  placeholder: ["generated", "default", "null/empty"],
  default: ["generated", "actual", "outdated", "hypothetical", "invalid", "null/empty"],
  hypothetical: ["generated", "actual", "default", "null/empty"],
  invalid: ["generated", "actual", "null/empty"],
  actual: ["outdated", "null/empty"],
  outdated: ["generated", "null/empty"],
};

// States that require a verification dialog before transitioning TO them
export const VERIFY_REQUIRED_STATES: IntentSemanticsState[] = ["actual"];
