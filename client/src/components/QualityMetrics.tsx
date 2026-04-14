"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HierarchyData, ElementData, AttributeData } from "@/types/aml";
import { EditModal } from "./EditModal";
import { EDITOR_ROLES, TRANSITION_MATRIX, IntentSemanticsState } from "@/constants/editorRoles";
import {
  INTENT_CONFIG,
  VALUE_CONFIG,
  MODE_REMINDERS,
} from "@/config/qualityMetrics";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

interface QualityMetricsTreeProps {
  hierarchyData: HierarchyData[];
  onRefresh: () => void;
}

interface EditingAttribute {
  elementName: string;
  attributeName: string;
  attributePath: string;
  currentValue: string;
  constraints: any[];
  isIntentSemantics?: boolean;
}

interface BreadcrumbItem {
  element: ElementData;
  label: string;
}

export function QualityMetricsTree({
  hierarchyData,
  onRefresh,
}: QualityMetricsTreeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingAttribute, setEditingAttribute] =
    useState<EditingAttribute | null>(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [editorId, setEditorId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem("qm_editorId") ?? "default" : "default")
  );
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [mode, setMode] = useState<"weight" | "evaluation" | "scores">(
    () => {
      if (typeof window === "undefined") return "weight";
      const saved = localStorage.getItem("qm_mode");
      if (saved === "evaluation" || saved === "scores") return saved;
      return "weight";
    }
  );
  const [showLegend, setShowLegend] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [transitionMatrix, setTransitionMatrix] = useState<Record<IntentSemanticsState, IntentSemanticsState[]>>(TRANSITION_MATRIX);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/intent-semantics/transitions`)
      .then((r) => r.json())
      .then(setTransitionMatrix)
      .catch(() => {}); // keep hardcoded fallback on error
  }, []);

  // Initialize breadcrumbs from URL on mount
  useEffect(() => {
    const path = searchParams.get("path");
    if (path && hierarchyData.length > 0) {
      const elementIds = path.split("/").filter(Boolean);
      const newBreadcrumbs: BreadcrumbItem[] = [];

      let currentElements = hierarchyData[0]?.elements[0]?.children || [];

      for (const elementId of elementIds) {
        const element = currentElements.find((e) => e.element_id === elementId);
        if (element) {
          newBreadcrumbs.push({ element, label: element.element_name });
          currentElements = element.children || [];
        } else {
          break;
        }
      }

      setBreadcrumbs(newBreadcrumbs);
    } else if (!path) {
      setBreadcrumbs([]);
    }
  }, [searchParams, hierarchyData]);

  // Persist selections across reloads
  useEffect(() => { localStorage.setItem("qm_editorId", editorId); }, [editorId]);
  useEffect(() => { localStorage.setItem("qm_mode", mode); }, [mode]);

  // Warn before leaving the page (browser's native dialog)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    // Errors stay until dismissed; successes auto-clear after 3 s.
    if (type === "success") {
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/download`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Q-Metrics.aml";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showAlert("Failed to download file.", "error");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        showAlert("File uploaded successfully. Refreshing...", "success");
        onRefresh();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Upload failed.", "error");
      }
    } catch {
      showAlert("Network error during upload.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset to the template file? All changes will be lost.")) return;

    try {
      setResetting(true);
      const response = await fetch(`${BACKEND_URL}/api/reset`, { method: "POST" });

      if (response.ok) {
        showAlert("Reset to template. Refreshing...", "success");
        onRefresh();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Reset failed.", "error");
      }
    } catch {
      showAlert("Network error during reset.", "error");
    } finally {
      setResetting(false);
    }
  };

  const handleSave = async (newValue: string) => {
    if (!editingAttribute) return;

    try {
      setSaving(true);

      const response = await fetch(`${BACKEND_URL}/api/update-attribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attribute_path: editingAttribute.attributePath,
          new_value: newValue,
          editor_id: mode === "evaluation" ? "evaluation" : editorId,
        }),
      });

      if (response.ok) {
        showAlert("Attribute updated test", "success");
        onRefresh();
        setEditingAttribute(null);
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Failed to update attribute", "error");
      }
    } catch (error) {
      showAlert("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const getAttributeValue = (
    attr: AttributeData,
    subAttrName: string
  ): string => {
    const subAttr = attr.sub_attributes?.find(
      (sa) => sa.attribute_name === subAttrName
    );
    return subAttr?.current_value || "N/A";
  };

  // In evaluation mode use the dedicated "evaluation" editor so reads match what was saved.
  const effectiveEditorId = mode === "evaluation" ? "evaluation" : editorId;

  // Pick the best match for the current editor: prefer editor-specific, fall back to default.
  const pickByEditor = (attrs: AttributeData[]): AttributeData | undefined => {
    if (effectiveEditorId === "default") {
      return attrs.find((a) => !a.editor_id) ?? attrs.find((a) => a.editor_id === "default");
    }
    return (
      attrs.find((a) => a.editor_id === effectiveEditorId) ??
      attrs.find((a) => !a.editor_id) ??
      attrs.find((a) => a.editor_id === "default")
    );
  };

  const getAllEditorScores = (element: ElementData) => {
    const weightings = element.attributes?.filter(
      (a) => a.attribute_name === "Percentage_Weighting"
    ) ?? [];
    return EDITOR_ROLES.filter((r) => r.id !== "default").map((role) => {
      const attr =
        weightings.find((a) => a.editor_id === role.id) ??
        weightings.find((a) => !a.editor_id) ??
        weightings.find((a) => a.editor_id === "default");
      return {
        role,
        weight: attr ? getAttributeValue(attr, "weight") : "N/A",
        result: attr ? getAttributeValue(attr, "result") : "N/A",
      };
    });
  };

  const getEditableAttributes = (element: ElementData): AttributeData[] => {
    const editableAttrs: AttributeData[] = [];

    const traverse = (attrs: AttributeData[]) => {
      // Group siblings by attribute_name so we can apply the fallback logic per name.
      const byName = new Map<string, AttributeData[]>();
      attrs.forEach((attr) => {
        const group = byName.get(attr.attribute_name) ?? [];
        group.push(attr);
        byName.set(attr.attribute_name, group);
      });

      byName.forEach((group, rawName) => {
        const name = rawName.toLowerCase();

        if (name === "percentage_weighting") {
          const chosen = pickByEditor(group);
          if (chosen) {
            // Weight only shown in weight mode (no cross-contamination).
            if (mode === "weight") {
              const weight = chosen.sub_attributes?.find(
                (sa) => sa.attribute_name === "weight"
              );
              if (weight && weight.editable) editableAttrs.push(weight);
            }
            // Intent semantics shown in both modes.
            const intentSemantics = chosen.sub_attributes?.find(
              (sa) => sa.attribute_name === "intent_semantics"
            );
            if (intentSemantics && intentSemantics.editable)
              editableAttrs.push(intentSemantics);
          }
          return;
        }

        if (name === "result" || name === "value_mapping" || name === "intent_semantics") return;

        // In weight mode, hide availability values so they don't influence weighting decisions.
        if (name === "value" && mode === "weight") return;

        const chosen = pickByEditor(group);
        if (chosen?.editable) {
          editableAttrs.push(chosen);
        }
        if (chosen?.sub_attributes) {
          traverse(chosen.sub_attributes);
        }
      });
    };

    traverse(element.attributes || []);
    return editableAttrs;
  };

  const navigateTo = (element: ElementData) => {
    const newBreadcrumbs = [
      ...breadcrumbs,
      { element, label: element.element_name },
    ];
    setBreadcrumbs(newBreadcrumbs);

    // Update URL
    const path = newBreadcrumbs.map((b) => b.element.element_id).join("/");
    router.push(`?path=${path}`, { scroll: false });
  };

  const navigateToIndex = (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      router.push("/", { scroll: false });
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);

      const path = newBreadcrumbs.map((b) => b.element.element_id).join("/");
      router.push(`?path=${path}`, { scroll: false });
    }
  };

  // Get top-level factors (Usability, Architecture, Validation, etc.)
  const getTopLevelFactors = (): ElementData[] => {
    const root = hierarchyData[0]?.elements[0]; // Q_Metric1
    return root?.children || [];
  };

  const getCurrentElements = (): ElementData[] => {
    if (breadcrumbs.length === 0) {
      return getTopLevelFactors();
    }

    const current = breadcrumbs[breadcrumbs.length - 1];
    return current.element.children || [];
  };

  const getCurrentLevel = (): {
    name: string;
    color: string;
    depth: number;
  } => {
    const depth = breadcrumbs.length;

    if (depth === 0) {
      return { name: "Quality Factors", color: "blue", depth: 0 };
    } else if (depth === 1) {
      return { name: "Criteria", color: "purple", depth: 1 };
    } else if (depth === 2) {
      return { name: "Attributes", color: "green", depth: 2 };
    } else {
      return { name: "Sub-Attributes", color: "amber", depth: 3 };
    }
  };

  const countChildren = (element: ElementData): number => {
    return element.children?.length || 0;
  };

  const countLeaves = (element: ElementData): number => {
    if (!element.children || element.children.length === 0) return 1;
    return element.children.reduce((sum, child) => sum + countLeaves(child), 0);
  };

  const formatValue = (value: string | null | undefined): string => {
    if (!value) return "N/A";

    // Check if it's a number between 0 and 1 (likely a percentage)
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
      return `${(numValue * 100).toFixed(1)}%`;
    }

    return value;
  };

  const formatAttributeName = (name: string): string => {
    // Handle common attribute names with specific formatting
    const specialCases: { [key: string]: string } = {
      intent_semantics: "Intent Semantics",
      value_mapping: "Value Mapping",
      value: "Value",
      result: "Result",
      weight: "Weight",
      current_value: "Current Value",
    };

    const lowerName = name.toLowerCase();
    if (specialCases[lowerName]) {
      return specialCases[lowerName];
    }

    // Convert snake_case or kebab-case to Title Case
    return name
      .replace(/[_-]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const renderCard = (element: ElementData) => {
    const hasChildren = element.children && element.children.length > 0;
    // value_mapping is a sub-attribute of the metric attribute (not a top-level element attribute,
    // and not inside Percentage_Weighting). Search one level deep in non-Percentage_Weighting attrs.
    const metricSubAttrs = !hasChildren
      ? (element.attributes
          ?.filter((a) => a.attribute_name.toLowerCase() !== "percentage_weighting")
          .flatMap((a) => a.sub_attributes ?? []) ?? [])
      : [];
    const valueMapping = metricSubAttrs.find((sa) => sa.attribute_name === "value_mapping")?.current_value ?? null;
    // Use Percentage_Weighting.intent_semantics (via pickByEditor) for score color — same field shown in the UI.
    const weightings = element.attributes?.filter((a) => a.attribute_name === "Percentage_Weighting") ?? [];
    const weightingAttr = !hasChildren ? pickByEditor(weightings) : null;
    const metricIntentSemantics = weightingAttr?.sub_attributes?.find((sa) => sa.attribute_name === "intent_semantics")?.current_value ?? null;
    const editableAttrs = getEditableAttributes(element);
    const currentLevel = getCurrentLevel();
    const childCount = countChildren(element);
    const leafCount = countLeaves(element);

    return (
      <div
        key={element.element_id}
        className={`
          bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 transition-all overflow-hidden
          ${
            currentLevel.color === "blue"
              ? "border-blue-300 hover:border-blue-500 hover:shadow-blue-200"
              : ""
          }
          ${
            currentLevel.color === "purple"
              ? "border-purple-300 hover:border-purple-500 hover:shadow-purple-200"
              : ""
          }
          ${
            currentLevel.color === "green"
              ? "border-green-300 hover:border-green-500 hover:shadow-green-200"
              : ""
          }
          ${
            currentLevel.color === "amber"
              ? "border-amber-300 hover:border-amber-500 hover:shadow-amber-200"
              : ""
          }
          ${hasChildren ? "cursor-pointer" : ""}
          hover:shadow-xl
        `}
        onClick={() => {
          if (hasChildren) {
            navigateTo(element);
          }
        }}
      >
        {/* Header */}
        <div
          className={`
            px-6 py-4 border-b
            ${
              currentLevel.color === "blue"
                ? "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200"
                : ""
            }
            ${
              currentLevel.color === "purple"
                ? "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200"
                : ""
            }
            ${
              currentLevel.color === "green"
                ? "bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200"
                : ""
            }
            ${
              currentLevel.color === "amber"
                ? "bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-200"
                : ""
            }
          `}
        >
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {element.element_name}
            </h3>

            {/* Score Display — evaluation mode, leaf elements only, unweighted */}
            {mode === "evaluation" && !hasChildren && valueMapping && (
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                    Score
                  </div>
                  <div
                    className={`text-4xl font-black tabular-nums [filter:drop-shadow(0_0_8px_currentColor)] ${
                      metricIntentSemantics === "actual"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {(parseFloat(valueMapping) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>
          {element.element_description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {element.element_description}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {/* All-Scores view */}
          {mode === "scores" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 pb-1 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Editor</span>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <span className="w-10 text-right">Weight</span>
                  <span className="w-16 text-right">Score</span>
                </div>
              </div>
              {getAllEditorScores(element).map(({ role, weight, result }) => (
                <div key={role.id} className="flex items-center justify-between gap-4 py-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{role.displayName}</span>
                  <div className="flex items-center gap-3 flex-shrink-0 tabular-nums text-sm font-medium">
                    <span className="text-gray-400 dark:text-gray-500">
                      {weight !== "N/A" ? `${(parseFloat(weight) * 100).toFixed(0)}%` : "—"}
                    </span>
                    <span className={`w-16 text-right font-semibold ${
                      result !== "N/A" ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
                    }`}>
                      {result !== "N/A" ? `${(parseFloat(result) * 100).toFixed(1)}%` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : hasChildren ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {childCount} direct{" "}
                      {childCount === 1 ? "child" : "children"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {leafCount} leaf {leafCount === 1 ? "metric" : "metrics"}{" "}
                      total
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                  <span>Explore</span>
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>

              {/* Show sample of editable attributes if any */}
              {editableAttrs.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                  Contains {editableAttrs.length} editable{" "}
                  {editableAttrs.length === 1 ? "attribute" : "attributes"}
                </div>
              )}
            </div>
          ) : editableAttrs.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Editable Attributes:
              </div>
              {editableAttrs.map((attr) => (
                <div
                  key={attr.attribute_path}
                  className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAttribute({
                      elementName: element.element_name,
                      attributeName: attr.attribute_name,
                      attributePath: attr.attribute_path,
                      currentValue: attr.current_value || "",
                      constraints: attr.constraints || [],
                      isIntentSemantics:
                        attr.attribute_name === "intent_semantics",
                    });
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {formatAttributeName(attr.attribute_name)}
                    </div>
                    <div className={`${attr.attribute_name === "value" || attr.attribute_name === "intent_semantics" ? "text-base" : "text-sm"} text-gray-600 dark:text-gray-400 break-words`}>
                      {formatValue(attr.current_value)}
                    </div>
                    {attr.attribute_name === "value" &&
                      attr.current_value &&
                      VALUE_CONFIG[attr.current_value] && (
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`w-3 h-3 rounded-full flex-shrink-0 ${VALUE_CONFIG[attr.current_value].dotColor}`}
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {VALUE_CONFIG[attr.current_value].description}
                          </span>
                        </div>
                      )}
                  </div>
                  <button
                    className="ml-3 p-2 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit attribute"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-sm">No editable attributes</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const currentElements = getCurrentElements();
  const currentLevel = getCurrentLevel();

  return (
    <div className={`space-y-6 ${showLegend ? "pb-28" : "pb-10"}`}>
      {/* Alert */}
      {alert && (
        <div
          className={`p-4 rounded-lg shadow-lg ${
            alert.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/80 dark:text-green-100"
              : "bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-100"
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === "success" ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span className="flex-1">{alert.message}</span>
            {alert.type === "error" && (
              <button
                onClick={() => setAlert(null)}
                className="ml-2 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg space-y-3">
        {/* Mode toggle + Refresh */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode("weight")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "weight"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Weight Mode
            </button>
            <button
              onClick={() => setMode("evaluation")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "evaluation"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Evaluation Mode
            </button>
            <button
              onClick={() => setMode("scores")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "scores"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              All Scores
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              title="Download Q-Metrics.aml"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".aml,.xml"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              title="Upload a new Q-Metrics.aml"
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
              )}
              {uploading ? "Uploading..." : "Upload"}
            </button>

            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              title="Reset to the template file"
            >
              {resetting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {resetting ? "Resetting..." : "Reset"}
            </button>
          </div>
        </div>

        {/* Mode reminder */}
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-700 dark:text-blue-300">
          {MODE_REMINDERS[mode]}
        </div>

        {/* Editor selector — only in weight mode */}
        {mode === "weight" && (
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Editor ID:
            </label>
            <select
              value={editorId}
              onChange={(e) => setEditorId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent cursor-pointer"
            >
              {EDITOR_ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button
              onClick={() => navigateToIndex(-1)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Quality Factors
            </button>
            {breadcrumbs.map((crumb, index) => (
              <div
                key={crumb.element.element_id}
                className="flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-gray-400"
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
                <button
                  onClick={() => navigateToIndex(index)}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Level Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {currentElements.length}{" "}
              {currentElements.length === 1 ? "item" : "items"} • Editor:{" "}
              <span className="font-mono font-semibold">{mode === "evaluation" ? "evaluation" : editorId}</span>
            </p>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-bold ${
              currentLevel.color === "blue"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                : currentLevel.color === "purple"
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                : currentLevel.color === "green"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
            Level {currentLevel.depth + 1}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentElements.map((element) => renderCard(element))}
      </div>

      {currentElements.length === 0 && (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-lg text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No items to display at this level
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editingAttribute && (
        <EditModal
          isOpen={true}
          elementName={editingAttribute.elementName}
          attributeName={editingAttribute.attributeName}
          currentValue={editingAttribute.currentValue}
          constraints={editingAttribute.constraints}
          onSave={handleSave}
          onClose={() => setEditingAttribute(null)}
          saving={saving}
          isIntentSemantics={editingAttribute.isIntentSemantics}
          transitionMatrix={transitionMatrix}
        />
      )}

      {/* Legend — horizontal bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        {showLegend && (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-col gap-3">
            {/* Row 1: Intent */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-10 flex-shrink-0">
                Intent
              </span>
              {Object.entries(INTENT_CONFIG).map(([key, { color, description }]) => (
                <span key={key} className="flex items-baseline gap-1">
                  <span className={`text-xs font-semibold ${color}`}>{key}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{description}</span>
                </span>
              ))}
              <button
                onClick={() => setShowLegend(false)}
                className="ml-auto flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Hide legend"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Row 2: Scale */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-10 flex-shrink-0">
                Scale
              </span>
              {(["not available", "occasionally available", "mostly available", "generally available"] as const).map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${VALUE_CONFIG[key].dotColor}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{key}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{VALUE_CONFIG[key].description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Re-open tab when collapsed */}
        {!showLegend && (
          <div className="flex justify-end pr-4">
            <button
              onClick={() => setShowLegend(true)}
              className="px-3 py-1 bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-b-0 border-gray-200 dark:border-gray-700 rounded-t-md text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
              title="Show legend"
            >
              Legend
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
