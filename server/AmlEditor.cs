using Aml.Engine.CAEX;
using Aml.Engine.CAEX.Extensions;
using Microsoft.Extensions.Logging;

public static class AmlEditor
{
    private static readonly Dictionary<string, (List<string> values, List<string> mappings)> _attributeMappings = new();

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public static List<object> ReadHierarchy(string amlFilePath, ILogger logger)
    {
        var doc = CAEXDocument.LoadFromFile(amlFilePath);
        LoadAttributeMappings(doc);
        ScoreCalculator.CalculateScore(doc, AmlConst.DefaultEditor, _attributeMappings, logger);

        var hierarchies = new List<object>();
        foreach (var ih in doc.CAEXFile.InstanceHierarchy)
        {
            logger.LogDebug("Processing InstanceHierarchy: {Name}", ih.Name);
            hierarchies.Add(new
            {
                instance_hierarchy = ih.Name,
                elements = ih.InternalElement
                    .Select(ie => ProcessInternalElement(ie, ih.Name, logger))
                    .ToList()
            });
        }

        return hierarchies;
    }

    public static string? UpdateAttribute(
        string attributePath, string newValue, string amlFilePath, ILogger logger, string editorId)
    {
        var doc = CAEXDocument.LoadFromFile(amlFilePath);
        LoadAttributeMappings(doc);

        var attr = doc.FindByPath(attributePath) as AttributeTypeType;
        if (attr == null)
        {
            logger.LogError("Attribute not found at path: {Path}", attributePath);
            return $"Attribute not found at path: {attributePath}";
        }

        var parentAttr = attr.GetParent<AttributeTypeType>();
        var parentElement = parentAttr?.GetParent<InternalElementType>();

        // Guard: top-level attribute (no parent attribute), just set and save
        if (parentAttr == null)
        {
            attr.Value = newValue;
            doc.SaveToFile(amlFilePath);
            doc = CAEXDocument.LoadFromFile(amlFilePath);
            ScoreCalculator.CalculateScore(doc, editorId, _attributeMappings, logger);
            doc.SaveToFile(amlFilePath);
            logger.LogInformation("Updated attribute '{Path}' to '{Value}'", attributePath, newValue);
            return null;
        }

        if (attr.Name == AmlConst.ValueIntention)
        {
            var error = ValidateValueIntentionUpdate(attr, parentAttr, parentElement, editorId, newValue, logger);
            if (error != null) return error;
        }

        if (parentAttr.Name == AmlConst.PercentageWeighting)
            UpdatePercentageWeighting(attr, parentAttr, parentElement, editorId, newValue);
        else
            attr.Value = newValue;

        if (attr.Name == AmlConst.Value)
            SyncValueMapping(parentAttr, newValue);

        doc.SaveToFile(amlFilePath);

        // Reload to ensure all changes are reflected before recalculating scores
        doc = CAEXDocument.LoadFromFile(amlFilePath);
        ScoreCalculator.CalculateScore(doc, editorId, _attributeMappings, logger);
        doc.SaveToFile(amlFilePath);

        logger.LogInformation("Updated attribute '{Path}' to '{Value}'", attributePath, newValue);
        return null;
    }

    // -------------------------------------------------------------------------
    // Private helpers — read
    // -------------------------------------------------------------------------

    private static object ProcessInternalElement(InternalElementType ie, string parentPath, ILogger logger)
    {
        logger.LogDebug("Processing InternalElement: {Name}", ie.Name);
        string currentPath = string.IsNullOrEmpty(parentPath) ? ie.Name : $"{parentPath}/{ie.Name}";

        return new
        {
            element_name = ie.Name,
            element_id = ie.ID,
            element_description = ie.Description,
            attributes = ie.Attribute.Select(attr => ProcessAttribute(attr)).ToList(),
            children = ie.InternalElement
                .Select(child => ProcessInternalElement(child, currentPath, logger))
                .ToList()
        };
    }

    private static object ProcessAttribute(AttributeTypeType attr)
    {
        string attrPath = attr.CAEXPath();
        bool editable = attr.Name != "result" && (attr.Value != null || attr.Constraint.Any());

        var constraints = attr.Constraint.Select(c =>
        {
            string type = null;
            if (c.NominalScaledType.AttributeDataType != null)
                type = "NominalScaledType";
            else if (c.OrdinalScaledType.AttributeDataType != null)
                // Check AttributeDataType because there is no cleaner null-check for OrdinalScaledType
                type = "OrdinalScaledType";

            return (object)new
            {
                has_constraint = true,
                name = c.Name,
                type = type,
                required_values = c.NominalScaledType?.RequiredValue?.ToList(),
                min_value = type == "OrdinalScaledType" ? c.OrdinalScaledType.RequiredMinValue : null,
                max_value = type == "OrdinalScaledType" ? c.OrdinalScaledType.RequiredMaxValue : null,
            };
        }).ToList();

        return new
        {
            attribute_name = attr.Name,
            editor_id = attr.GetXAttributeValue(AmlConst.EditorId) ?? AmlConst.DefaultEditor,
            attribute_path = attrPath,
            current_value = attr.Value,
            constraints = constraints,
            editable = editable,
            sub_attributes = attr.Attribute.Select(sub => ProcessAttribute(sub)).ToList()
        };
    }

    // -------------------------------------------------------------------------
    // Private helpers — update
    // -------------------------------------------------------------------------

    private static string? ValidateValueIntentionUpdate(
        AttributeTypeType attr,
        AttributeTypeType parentAttr,
        InternalElementType? parentElement,
        string editorId,
        string newValue,
        ILogger logger)
    {
        // When inside a Percentage_Weighting, look up the editor-specific copy's current
        // value rather than the default copy that FindByPath may have returned.
        string currentValue;
        if (parentAttr?.Name == AmlConst.PercentageWeighting && parentElement != null)
        {
            var editorWeighting = parentElement.Attribute.FirstOrDefault(a =>
                a.Name == AmlConst.PercentageWeighting && a.GetXAttributeValue(AmlConst.EditorId) == editorId);
            currentValue = editorWeighting?.Attribute[attr.Name]?.Value ?? attr.Value;
        }
        else
        {
            currentValue = attr.Value;
        }

        if (currentValue == null) return null;

        var error = ValueIntentionValidator.Validate(currentValue, newValue);
        if (error != null)
            logger.LogWarning("Intent semantics transition rejected: {Error}", error);
        return error;
    }

    private static void UpdatePercentageWeighting(
        AttributeTypeType attr,
        AttributeTypeType parentAttr,
        InternalElementType? parentElement,
        string editorId,
        string newValue)
    {
        if (parentElement == null) return;

        var editorWeighting = parentElement.Attribute.FirstOrDefault(a =>
            a.Name == AmlConst.PercentageWeighting && a.GetXAttributeValue(AmlConst.EditorId) == editorId);

        if (editorWeighting != null)
        {
            editorWeighting.Attribute[attr.Name].Value = newValue;
        }
        else
        {
            var copy = parentAttr.Copy() as AttributeTypeType;
            parentElement.Insert(copy, asFirst: false);
            copy.SetXAttributeValue(AmlConst.EditorId, editorId);
            copy.Attribute[attr.Name].Value = newValue;
        }
    }

    private static void SyncValueMapping(AttributeTypeType parentAttr, string newValue)
    {
        if (parentAttr == null) return;
        if (!_attributeMappings.TryGetValue(parentAttr.Name, out var mapping)) return;

        int index = mapping.values.IndexOf(newValue);
        if (index < 0 || index >= mapping.mappings.Count) return;

        var mappedValue = mapping.mappings[index];
        parentAttr.Attribute[AmlConst.ValueMapping].Value = mappedValue;
        parentAttr.Attribute[AmlConst.Result].Value = mappedValue;
    }

    private static void LoadAttributeMappings(CAEXDocument doc)
    {
        _attributeMappings.Clear();
        var attributeTypeLib = doc.AttributeTypeLib.FirstOrDefault();
        if (attributeTypeLib == null) return;

        foreach (var attrType in attributeTypeLib.AttributeType)
        {
            // percentage_weighting has no value/value_mapping pair — skip it
            if (attrType.Attribute[AmlConst.Value] == null || attrType.Attribute[AmlConst.ValueMapping] == null)
                continue;

            var values = attrType.Attribute[AmlConst.Value].Constraint.First().NominalScaledType.RequiredValue.ToList();
            var mappings = attrType.Attribute[AmlConst.ValueMapping].Constraint.First().NominalScaledType.RequiredValue.ToList();
            _attributeMappings[attrType.Name] = (values, mappings);
        }
    }
}
