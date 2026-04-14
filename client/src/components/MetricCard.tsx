"use client";

import { ElementData, AttributeData } from "@/types/aml";

interface MetricCardProps {
  element: ElementData;
  editableAttributes: AttributeData[];
  score: string | null;
  onEdit: (attr: AttributeData) => void;
}

export function MetricCard({
  element,
  editableAttributes,
  score,
  onEdit,
}: MetricCardProps) {
  const getScoreColor = (scoreValue: string | null): string => {
    if (!scoreValue) return "text-gray-400";

    const score = parseFloat(scoreValue);
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBackground = (scoreValue: string | null): string => {
    if (!scoreValue) return "bg-gray-50";

    const score = parseFloat(scoreValue);
    if (score >= 0.8) return "bg-green-50";
    if (score >= 0.5) return "bg-yellow-50";
    return "bg-red-50";
  };

  const formatValue = (value: string | null): string => {
    if (!value) return "Not set";
    return value;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div
        className={`px-6 py-4 border-b border-gray-200 ${getScoreBackground(
          score
        )}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {element.element_name}
            </h3>
            {element.element_description && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {element.element_description}
              </p>
            )}
          </div>

          {score !== null && (
            <div className="flex-shrink-0">
              <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                {(parseFloat(score) * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attributes */}
      <div className="p-6 space-y-4">
        {editableAttributes.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No editable attributes
          </p>
        ) : (
          editableAttributes.map((attr) => (
            <div key={attr.attribute_path} className="group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {attr.attribute_name}
                  </label>
                  <div className="text-sm text-gray-900 break-words">
                    {formatValue(attr.current_value)}
                  </div>
                </div>

                <button
                  onClick={() => onEdit(attr)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
