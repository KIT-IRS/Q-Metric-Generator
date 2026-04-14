using Aml.Engine.Adapter;
using Aml.Engine.CAEX;
using Aml.Engine.Services;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Xml.Linq;

public static class ExternalReferenceResolver
{
    private static readonly HttpClient _http = new();
    private static readonly XNamespace _caex = "http://www.dke.de/CAEX";

    // Fallback used when the concept server is unavailable
    private static readonly (List<string> values, string dataType) BackupIntentSemantics = (
        new List<string> { "null/empty", "generated", "placeholder", "default", "hypothetical", "invalid", "actual", "outdated" },
        "xs:string"
    );

    public static void ResolveExternalReferences(string amlFilePath, ILogger logger)
    {
        logger.LogInformation("Resolving external references for: {Path}", amlFilePath);

        try
        {
            var doc = CAEXDocument.LoadFromFile(amlFilePath);
            var queryService = new QueryService();
            ServiceLocator.Register(queryService);

            foreach (var attributeTypeLib in doc.AttributeTypeLib)
            {
                logger.LogInformation("Scanning AttributeTypeLib: {Name}", attributeTypeLib.Name);

                foreach (var attrType in attributeTypeLib.AttributeType)
                {
                    var refSemantic = attrType.RefSemantic.FirstOrDefault();
                    if (refSemantic == null) continue;

                    var url = refSemantic.CorrespondingAttributePath;
                    if (string.IsNullOrEmpty(url) || !url.StartsWith("http")) continue;

                    logger.LogInformation("Fetching concept description for '{Name}' from {Url}", attrType.Name, url);

                    List<string> allowedValues;
                    string dataType;
                    bool usingBackup = false;
                    try
                    {
                        var json = _http.GetStringAsync(url).GetAwaiter().GetResult();
                        (allowedValues, dataType) = ParseConceptDescription(json);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError("Concept server unavailable at {Url}: {Message} — using backup intent semantics", url, ex.Message);
                        (allowedValues, dataType) = BackupIntentSemantics;
                        usingBackup = true;
                    }

                    bool initValues = usingBackup || string.Equals(
                        Environment.GetEnvironmentVariable("INIT_INTENT_SEMANTICS"), "true",
                        StringComparison.OrdinalIgnoreCase);

                    var refPath = $"{attributeTypeLib.Name}/{attrType.Name}";
                    var references = queryService.ElementsWithCAEXPathReference(doc.CAEXFile, refPath).ToList();
                    int populatedCount = 0;

                    foreach (var reference in references)
                    {
                        if (reference.CaexObject is not AttributeTypeType targetAttr) continue;

                        targetAttr.AttributeDataType = dataType;
                        AddNominalConstraint(targetAttr, allowedValues);

                        if (initValues && string.IsNullOrEmpty(targetAttr.Value) && allowedValues.Count > 0)
                            targetAttr.Value = "default";

                        populatedCount++;
                        logger.LogDebug("Populated '{TypeName}' on '{AttrName}'", attrType.Name, targetAttr.Name);
                    }

                    logger.LogInformation("Populated {Count} attribute(s) referencing '{Name}'", populatedCount, attrType.Name);
                }
            }

            doc.SaveToFile(amlFilePath);
            logger.LogInformation("External reference resolution completed.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to resolve external references: {Message}", ex.Message);
            throw;
        }
    }

    private static (List<string> values, string dataType) ParseConceptDescription(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        string dataType = "xs:string";
        var values = new List<string>();

        if (!root.TryGetProperty("embeddedDataSpecifications", out var specs) || specs.GetArrayLength() == 0)
            return (values, dataType);

        var content = specs[0].GetProperty("dataSpecificationContent");

        if (content.TryGetProperty("dataType", out var dt))
        {
            dataType = dt.GetString() switch
            {
                "STRING" => "xs:string",
                "INT"    => "xs:int",
                "FLOAT"  => "xs:float",
                var s    => s ?? "xs:string"
            };
        }

        if (content.TryGetProperty("valueList", out var valueList) &&
            valueList.TryGetProperty("valueReferencePairs", out var pairs))
        {
            foreach (var pair in pairs.EnumerateArray())
            {
                if (pair.TryGetProperty("value", out var v))
                    values.Add(v.GetString() ?? "");
            }
        }

        return (values, dataType);
    }

    private static void AddNominalConstraint(AttributeTypeType attr, List<string> values)
    {
        var constraintElem = new XElement(_caex + "Constraint",
            new XAttribute("Name", "AllowedValues"),
            new XElement(_caex + "NominalScaledType",
                values.Select(v => new XElement(_caex + "RequiredValue", v))
            )
        );
        attr.Node.Add(constraintElem);
    }
}
