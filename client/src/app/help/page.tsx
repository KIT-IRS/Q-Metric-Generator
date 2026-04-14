"use client";

import Link from "next/link";
import { useState } from "react";
import { EDITOR_ROLES, EditorRole } from "@/constants/editorRoles";
import { INTENT_CONFIG, VALUE_CONFIG } from "@/config/qualityMetrics";

// ─── Role-specific content ──────────────────────────────────────────────────

interface RoleContent {
  headline: string;
  description: string;
  weightGuidance: string;
  evaluationGuidance: string;
  tips: string[];
}

const ROLE_CONTENT: Record<string, RoleContent> = {
  modelling_engineer: {
    headline: "You build and maintain the model.",
    description:
      "As a Modelling Engineer you are responsible for the technical accuracy of the simulation model — its data types, interfaces, semantic definitions, and documentation.",
    weightGuidance:
      "Weight attributes that reflect technical completeness: data type, unit, semantics, and interface documentation typically deserve high weights. Aspects less relevant to model correctness (e.g. operational metadata) can receive lower weights.",
    evaluationGuidance:
      "Work through Sub-Attribute cards at the deepest level. For each one set the Value (not available → generally available) and update the Value Intention once you are certain about the data origin. Use 'actual' only after you have confirmed the data reflects verified real-world information.",
    tips: [
      "Start at the lowest level (Sub-Attributes, amber cards) and fill in all Value fields first.",
      "Leave Value Intention as 'default' until you have verified the data — then promote it to 'actual'.",
      "Use 'placeholder' when you know data will arrive but hasn't been collected yet.",
      "Use 'outdated' for values that were once correct but may no longer apply.",
    ],
  },
  internal_reviewer: {
    headline: "You validate the model internally.",
    description:
      "As an Internal Reviewer you assess whether the model meets internal quality standards — checking documentation completeness, traceability, and consistency before the model is used in projects.",
    weightGuidance:
      "Give high weight to documentation-related attributes (descriptions, references, change history) and validation evidence. Lower weights can apply to runtime-specific metrics that other roles handle.",
    evaluationGuidance:
      "Review each attribute against internal checklists. Set values based on what is actually present in the model documentation. If a value is confirmed and cross-checked, set Value Intention to 'actual'.",
    tips: [
      "Compare the attribute values against the model documentation and source data.",
      "If an attribute is marked 'generally available' but you cannot verify it, set Value Intention to 'hypothetical' or leave it as 'default'.",
      "Use the All Scores tab to compare your assessment with other reviewers.",
    ],
  },
  internal_user: {
    headline: "You use the model inside your organisation.",
    description:
      "As an Internal User you apply the simulation model for internal studies, analyses, or decision support. You care about usability, result quality, and whether the model fits your specific use case.",
    weightGuidance:
      "Prioritise usability-related attributes: ease of parameterisation, result interpretability, and validation status. Technical implementation details may be less relevant to your weighting.",
    evaluationGuidance:
      "Evaluate attributes based on your direct experience using the model. If you have run simulations, your evaluation of result quality and usability is the most valuable input.",
    tips: [
      "Focus on the Usability and Validation factors — these directly affect your work.",
      "Rate attributes based on actual experience, not assumptions.",
      "If you haven't used a particular aspect of the model yet, leave it as 'default' rather than guessing.",
    ],
  },
  external_system_integrator: {
    headline: "You integrate the model into external systems.",
    description:
      "As a 3rd Party System Integrator you connect the simulation model to other tools, platforms, or workflows. Interface compatibility, data formats, and export/import capabilities are your primary concern.",
    weightGuidance:
      "Weight interface-related attributes highly: data types, units, input/output formats, and API compatibility. Internal documentation quality may matter less if the interfaces are clean.",
    evaluationGuidance:
      "Assess attributes based on integration tests and interface inspections. Mark attributes as 'generally available' only if they work reliably in your integration context.",
    tips: [
      "Check data type and unit attributes carefully — mismatches are a common integration failure point.",
      "Use 'occasionally available' when an attribute works in some configurations but not all.",
      "Document any integration issues in the model description fields.",
    ],
  },
  platform_operator: {
    headline: "You operate the simulation platform.",
    description:
      "As a Platform Operator you are responsible for deploying, running, and maintaining the environment in which the simulation model executes. You focus on operational stability, performance, and resource requirements.",
    weightGuidance:
      "Give high weight to attributes related to runtime behaviour, resource consumption, and deployment requirements. Documentation completeness is also important for onboarding and maintenance.",
    evaluationGuidance:
      "Evaluate based on observed runtime behaviour in your environment. Performance and stability attributes should reflect real measurements where possible.",
    tips: [
      "Set Value Intention to 'actual' only for attributes you have directly measured or observed in production.",
      "Use 'hypothetical' for estimates that have not been validated in your deployment environment.",
      "Check the Scores tab regularly to see how your platform assessments compare to other roles.",
    ],
  },
  model_user: {
    headline: "You consume the simulation results.",
    description:
      "As a Model User you rely on the simulation output for decisions, reports, or further analysis. Your perspective centres on result trustworthiness, ease of use, and interpretability.",
    weightGuidance:
      "Weight result quality, validation status, and interpretability attributes most heavily. Technical implementation aspects are less relevant from a user perspective.",
    evaluationGuidance:
      "Evaluate based on your experience with the model's outputs. Can you trust the results? Are they well documented? Is the model easy to parameterise for your scenarios?",
    tips: [
      "Focus on the Usability and Validation factors — these directly reflect your user experience.",
      "If the model produces unexplained results or lacks documentation, mark those attributes as 'not available' or 'occasionally available'.",
      "Use 'actual' only when you have directly verified a quality aspect through your own use.",
    ],
  },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function LevelBadge({
  color,
  label,
  description,
}: {
  color: string;
  label: string;
  description: string;
}) {
  const dotColors: Record<string, string> = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
    amber: "bg-amber-500",
  };
  const borderColors: Record<string, string> = {
    blue: "border-blue-200 dark:border-blue-800",
    purple: "border-purple-200 dark:border-purple-800",
    green: "border-green-200 dark:border-green-800",
    amber: "border-amber-200 dark:border-amber-800",
  };
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${borderColors[color]} bg-white dark:bg-gray-800`}
    >
      <div
        className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${dotColors[color]}`}
      />
      <div>
        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {label}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {description}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const roleContent = selectedRole ? ROLE_CONTENT[selectedRole] : null;
  const selectedRoleLabel = EDITOR_ROLES.find(
    (r) => r.id === selectedRole
  )?.displayName;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Editor
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Q-Metric Help
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            A guide to assessing simulation model quality with the Q-Metric
            framework.{" "}
            <a
              href="https://www.irs.kit.edu/simulation-quality.php"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Learn more at IRS ↗
            </a>
          </p>
        </header>

        {/* ── Section 1: How Q-Metric Works ── */}
        <SectionCard title="How Q-Metric Works">
          <div className="space-y-4 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            <p>
              The <strong>Q-Metric</strong> (Qualitätsmetrik) is a role-based
              framework developed at KIT IRS for the <em>objective, measurable
              assessment</em> of simulation model quality. It bundles central
              quality attributes and ties them to engineering roles so that
              different stakeholders can express their individual quality
              perspective.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                  Comparability
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-400">
                  Uniform quality statements across models from different sources
                  and vendors.
                </div>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="font-semibold text-purple-800 dark:text-purple-300 mb-1">
                  Role Orientation
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-400">
                  Each engineering role weights and evaluates quality according
                  to its own perspective.
                </div>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  Transparency
                </div>
                <div className="text-xs text-emerald-700 dark:text-emerald-400">
                  Quality can be specified as part of delivery scope and service
                  agreements.
                </div>
              </div>
            </div>

            <p>
              Quality is organised in a <strong>4-level hierarchy</strong>.
              Scores at the leaf level (Sub-Attributes) are computed from the
              attribute value and rolled up through weighted averages to the
              top-level Quality Factors.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2 mt-2 text-center text-xs font-medium">
              {[
                { label: "Quality Factors", color: "bg-blue-500", text: "text-blue-700 dark:text-blue-300" },
                { label: "Criteria", color: "bg-purple-500", text: "text-purple-700 dark:text-purple-300" },
                { label: "Attributes", color: "bg-green-500", text: "text-green-700 dark:text-green-300" },
                { label: "Sub-Attributes", color: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
              ].map((level, i, arr) => (
                <div key={level.label} className="flex items-center gap-2">
                  <div
                    className={`px-3 py-1.5 rounded-full ${level.color} bg-opacity-20 border border-current ${level.text}`}
                  >
                    {level.label}
                  </div>
                  {i < arr.length - 1 && (
                    <svg
                      className="w-4 h-4 text-gray-400 hidden sm:block"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── Section 2: How to Read the Interface ── */}
        <SectionCard title="How to Read the Interface">
          <div className="space-y-6">
            {/* Hierarchy levels */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">
                Hierarchy Levels
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <LevelBadge
                  color="blue"
                  label="Quality Factors (Level 1)"
                  description="Top-level quality dimensions, e.g. Usability, Architecture, Validation."
                />
                <LevelBadge
                  color="purple"
                  label="Criteria (Level 2)"
                  description="Grouped aspects within a factor, e.g. Documentation, Interface."
                />
                <LevelBadge
                  color="green"
                  label="Attributes (Level 3)"
                  description="Specific quality properties, e.g. Parameters, Signals."
                />
                <LevelBadge
                  color="amber"
                  label="Sub-Attributes (Level 4)"
                  description="Leaf-level measurable items that carry actual values and scores."
                />
              </div>
            </div>

            {/* Modes */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">
                Modes
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 w-24 flex-shrink-0">
                    Weight
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Assign importance weights (0–100%) to each attribute based
                    on your engineering role. These weights determine how much
                    each attribute contributes to the overall score.
                  </span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 w-24 flex-shrink-0">
                    Evaluation
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Fill in the availability value for each leaf attribute and
                    set the Value Intention to reflect your confidence in the
                    data. A score (0–100%) is computed automatically.
                  </span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 w-24 flex-shrink-0">
                    All Scores
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Overview of weights and scores across all editor roles for
                    every element. Useful for comparing perspectives.
                  </span>
                </div>
              </div>
            </div>

            {/* Value scale */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">
                Availability Scale
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    "not available",
                    "occasionally available",
                    "mostly available",
                    "generally available",
                  ] as const
                ).map((key) => {
                  const cfg = VALUE_CONFIG[key];
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div
                        className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${cfg.dotColor}`}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">
                          {key}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {cfg.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Value intention */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">
                Value Intention States
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Every value has an <em>intention</em> that describes the
                confidence and origin of the data. The state follows a
                defined transition path — not all changes are allowed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  Object.entries(INTENT_CONFIG) as [
                    string,
                    { color: string; description: string }
                  ][]
                ).map(([key, cfg]) => (
                  <div
                    key={key}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <span
                      className={`text-sm font-semibold font-mono flex-shrink-0 ${cfg.color}`}
                    >
                      {key}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {cfg.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Section 3: Who Are You? ── */}
        <SectionCard title="Who Are You?">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select your engineering role to see personalised usage guidance.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EDITOR_ROLES.filter((r) => r.id !== "default").map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() =>
                    setSelectedRole(isSelected ? null : role.id)
                  }
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  <div
                    className={`font-semibold text-sm ${
                      isSelected
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {role.displayName}
                  </div>
                  {ROLE_CONTENT[role.id] && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {ROLE_CONTENT[role.id].headline}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Section 4: Role-specific How To ── */}
        {roleContent && selectedRoleLabel && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-blue-400 dark:border-blue-600 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-b border-blue-200 dark:border-blue-700">
              <div className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-1">
                How to use as
              </div>
              <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                {selectedRoleLabel}
              </h2>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {roleContent.headline}
              </p>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {roleContent.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Weight Mode
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {roleContent.weightGuidance}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Evaluation Mode
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {roleContent.evaluationGuidance}
                  </p>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Tips
                </div>
                <ul className="space-y-2">
                  {roleContent.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg
                        className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-400 dark:text-gray-600 pb-4">
          Q-Metric Generator · Institut für Regelungs- und Steuerungssysteme (IRS) ·{" "}
          <a
            href="https://www.irs.kit.edu/simulation-quality.php"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            irs.kit.edu/simulation-quality.php
          </a>
        </footer>
      </div>
    </main>
  );
}
