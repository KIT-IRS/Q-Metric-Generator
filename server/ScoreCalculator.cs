using Aml.Engine.CAEX;
using Aml.Engine.CAEX.Extensions;
using Microsoft.Extensions.Logging;

public static class ScoreCalculator
{
    public static void CalculateScore(
        CAEXDocument doc,
        string editorId,
        Dictionary<string, (List<string> values, List<string> mappings)> attributeMappings,
        ILogger logger)
    {
        foreach (var ie in doc.InstanceHierarchy[AmlConst.QualityMetricsHierarchy].InternalElement)
            CalculateElementScore(ie, editorId, attributeMappings, logger);
    }

    private static void CalculateElementScore(
        InternalElementType element,
        string editorId,
        Dictionary<string, (List<string> values, List<string> mappings)> attributeMappings,
        ILogger logger)
    {
        // Recurse depth-first so scores are calculated bottom-up
        foreach (var child in element.InternalElement)
            CalculateElementScore(child, editorId, attributeMappings, logger);

        var (totalWeightedScore, totalWeight) = element.InternalElement.Any()
            ? SumChildScores(element, editorId, logger)
            : GetLeafScore(element, attributeMappings);

        if (totalWeight <= 0) return;

        var weightAttr = FindOrCreateWeightingForEditor(element, editorId);
        if (weightAttr?.Attribute["result"]?.Value == null) return;

        weightAttr.Attribute["result"].Value = (totalWeightedScore / totalWeight).ToString("F2");
    }

    private static (double weightedScore, double totalWeight) SumChildScores(
        InternalElementType element, string editorId, ILogger logger)
    {
        double totalWeightedScore = 0;
        double totalWeight = 0;

        foreach (var child in element.InternalElement)
        {
            var weightAttr = FindWeightingForEditor(child, editorId);
            if (weightAttr == null)
            {
                logger.LogWarning(
                    "No Percentage_Weighting found for editor '{EditorId}' in '{ElementName}' — skipping",
                    editorId, child.Name);
                continue;
            }

            double.TryParse(weightAttr.Attribute[AmlConst.Weight]?.Value, out double weight);
            double.TryParse(weightAttr.Attribute[AmlConst.Result]?.Value, out double score);

            totalWeightedScore += score * weight;
            totalWeight += weight;
        }

        return (totalWeightedScore, totalWeight);
    }

    private static (double score, double weight) GetLeafScore(
        InternalElementType element,
        Dictionary<string, (List<string> values, List<string> mappings)> attributeMappings)
    {
        foreach (var attr in element.Attribute)
        {
            bool isMetricAttr =
                !string.IsNullOrEmpty(attr.RefAttributeType) &&
                attr.RefAttributeType.Contains("Simulation_Quality_Metric_Attribute_Libary") &&
                !attr.RefAttributeType.Contains("Percentage_Weighting") &&
                attributeMappings.ContainsKey(attr.Name);

            if (!isMetricAttr) continue;

            double.TryParse(
                attr.Attribute[AmlConst.ValueMapping]?.Value ?? attr.Attribute[AmlConst.Result]?.Value,
                out double score);

            return (score, 1);
        }

        return (0, 0);
    }

    private static AttributeTypeType? FindWeightingForEditor(InternalElementType element, string editorId)
        => FindPercentageWeightingByEditorId(element, editorId, createIfMissing: false);

    private static AttributeTypeType? FindOrCreateWeightingForEditor(InternalElementType element, string editorId)
        => FindPercentageWeightingByEditorId(element, editorId, createIfMissing: true);

    private static AttributeTypeType? FindPercentageWeightingByEditorId(
        InternalElementType element, string editorId, bool createIfMissing)
    {
        // Try to find the exact editor's weighting first
        var exact = element.Attribute.FirstOrDefault(a =>
            a.Name == "Percentage_Weighting" && a.GetXAttributeValue("editor_id") == editorId);

        if (exact != null) return exact;

        // Fall back to the default weighting (editor_id == "default" or missing)
        var defaultWeighting = element.Attribute.FirstOrDefault(a =>
            a.Name == "Percentage_Weighting" &&
            (a.GetXAttributeValue("editor_id") == "default" || a.GetXAttributeValue("editor_id") == null));

        if (defaultWeighting == null) return null;

        // For a non-default editor, optionally create a copy from the default
        if (createIfMissing && editorId != "default")
        {
            var copy = defaultWeighting.Copy() as AttributeTypeType;
            element.Insert(copy, asFirst: false);
            copy.SetXAttributeValue("editor_id", editorId);
            return copy;
        }

        return defaultWeighting;
    }
}
