"use client";

import { useState, useEffect } from "react";
import {
  TRANSITION_MATRIX,
  VERIFY_REQUIRED_STATES,
  IntentSemanticsState,
} from "@/constants/editorRoles";


interface Constraint {
  has_constraint: boolean;
  name: string;
  type: "NominalScaledType" | "OrdinalScaledType";
  required_values?: string[];
  min_value?: string;
  max_value?: string;
}

interface EditModalProps {
  isOpen: boolean;
  elementName: string;
  attributeName: string;
  currentValue: string;
  constraints: Constraint[];
  onSave: (newValue: string) => void;
  onClose: () => void;
  saving?: boolean;
  isIntentSemantics?: boolean;
  transitionMatrix?: Record<string, IntentSemanticsState[]>;
}

export function EditModal({
  isOpen,
  elementName,
  attributeName,
  currentValue,
  constraints = [],
  onSave,
  onClose,
  saving = false,
  isIntentSemantics = false,
  transitionMatrix = TRANSITION_MATRIX,
}: EditModalProps) {
  const [value, setValue] = useState(currentValue);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);

  useEffect(() => {
    setValue(currentValue);
    setValidationError(null);
    setShowVerifyDialog(false);
  }, [currentValue, isOpen]);

  if (!isOpen) return null;

  const constraint = constraints.length > 0 ? constraints[0] : null;
  const isNominal = constraint?.type === "NominalScaledType";
  const isOrdinal = constraint?.type === "OrdinalScaledType";

  // Filter nominal values through transition matrix for intent_semantics attributes
  const nominalOptions = (() => {
    if (!isNominal || !constraint?.required_values) return [];
    if (!isIntentSemantics) return constraint.required_values;

    const current = currentValue as IntentSemanticsState;
    const allowed = transitionMatrix[current];
    if (!allowed) return constraint.required_values;
    return constraint.required_values.filter((v) =>
      allowed.includes(v as IntentSemanticsState)
    );
  })();

  const validateValue = (val: string): boolean => {
    if (!constraint) return true;

    if (isNominal && constraint.required_values) {
      if (!constraint.required_values.includes(val)) {
        setValidationError("Please select one of the allowed values");
        return false;
      }
    }

    if (isOrdinal) {
      const numValue = parseFloat(val);
      if (isNaN(numValue)) {
        setValidationError("Value must be a number");
        return false;
      }

      const min = constraint.min_value
        ? parseFloat(constraint.min_value)
        : -Infinity;
      const max = constraint.max_value
        ? parseFloat(constraint.max_value)
        : Infinity;

      if (numValue < min || numValue > max) {
        setValidationError(`Value must be between ${min} and ${max}`);
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateValue(value)) {
      if (
        isIntentSemantics &&
        VERIFY_REQUIRED_STATES.includes(value as IntentSemanticsState)
      ) {
        setShowVerifyDialog(true);
        return;
      }
      onSave(value);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit {attributeName}
              </h2>
              <button
                onClick={onClose}
                disabled={saving}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-1">{elementName}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Current value:</span>{" "}
                <span className="text-gray-900">
                  {currentValue || "Not set"}
                </span>
              </div>

              {isNominal && nominalOptions.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {isIntentSemantics
                      ? "Allowed transitions:"
                      : "Select value:"}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {nominalOptions.map((option, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setValue(option);
                          setValidationError(null);
                        }}
                        className={`px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                          value === option
                            ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-500 ring-offset-2"
                            : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : isOrdinal ? (
                <div className="space-y-2">
                  <label
                    htmlFor="value-input"
                    className="block text-sm font-medium text-gray-700"
                  >
                    New value:
                  </label>
                  <input
                    id="value-input"
                    type="number"
                    step="any"
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setValidationError(null);
                    }}
                    min={constraint?.min_value}
                    max={constraint?.max_value}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    disabled={saving}
                    autoFocus
                  />
                  {constraint?.min_value && constraint?.max_value && (
                    <p className="text-xs text-gray-900">
                      Range: {constraint.min_value} to {constraint.max_value}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="value-input"
                    className="block text-sm font-medium text-gray-700"
                  >
                    New value:
                  </label>
                  <input
                    id="value-input"
                    type="text"
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    disabled={saving}
                    autoFocus
                  />
                </div>
              )}

              {validationError && (
                <div className="px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  {validationError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || value === currentValue}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Verify Dialog Overlay */}
      {showVerifyDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowVerifyDialog(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-200 bg-amber-50">
              <h3 className="text-lg font-semibold text-amber-900">
                Confirm Value as Actual
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                You are about to mark this intent semantics as{" "}
                <span className="font-bold text-amber-700">&quot;actual&quot;</span>.
                This confirms the associated value has been reviewed and
                represents verified, real-world data.
              </p>
              <div className="text-sm bg-gray-50 rounded-lg p-3 space-y-1">
                <div>
                  <span className="font-medium text-gray-500">Element:</span>{" "}
                  <span className="text-gray-900">{elementName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">
                    Current state:
                  </span>{" "}
                  <span className="text-gray-900">{currentValue}</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyDialog(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVerifyDialog(false);
                    onSave(value);
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Confirm as Actual"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
