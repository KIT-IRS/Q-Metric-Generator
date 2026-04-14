using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

public static class AmlEndpointExtensions
{
    public static void MapAmlEndpoints(
        this WebApplication app, string amlFilePath, string templateFilePath, ILogger logger)
    {
        app.MapGet("/api/intent-semantics/transitions", async (HttpContext context) =>
        {
            var options = new JsonSerializerOptions { WriteIndented = true };
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(ValueIntentionValidator.AllowedTransitions, options));
        });

        app.MapGet("/api/hierarchy", async (HttpContext context) =>
        {
            var hierarchies = AmlEditor.ReadHierarchy(amlFilePath, logger);
            var options = new JsonSerializerOptions { WriteIndented = true };
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(hierarchies, options));
        });

        app.MapPost("/api/update-attribute", async (HttpContext context) =>
        {
            var body = await JsonSerializer.DeserializeAsync<JsonElement>(context.Request.Body);
            string attributePath = body.GetProperty("attribute_path").GetString() ?? "";
            string newValue = body.GetProperty("new_value").GetString() ?? "";
            string editorId = body.GetProperty("editor_id").GetString() ?? "";

            logger.LogDebug("Update request: attribute_path={AttributePath}, new_value={NewValue}, editor_id={EditorId}",
                attributePath, newValue, editorId);

            if (string.IsNullOrEmpty(editorId) || editorId == "default")
            {
                await WriteErrorAsync(context, 400, "editor_id is required and cannot be 'default'");
                return;
            }

            var error = AmlEditor.UpdateAttribute(attributePath, newValue, amlFilePath, logger, editorId);
            if (error != null)
            {
                await WriteErrorAsync(context, 400, error);
                return;
            }

            await WriteSuccessAsync(context);
        });

        app.MapGet("/api/download", async (HttpContext context) =>
        {
            if (!File.Exists(amlFilePath))
            {
                await WriteErrorAsync(context, 404, "File not found");
                return;
            }

            var fileBytes = await File.ReadAllBytesAsync(amlFilePath);
            context.Response.ContentType = "application/xml";
            context.Response.Headers.Append("Content-Disposition", "attachment; filename=\"Q-Metrics.aml\"");
            context.Response.ContentLength = fileBytes.Length;
            await context.Response.Body.WriteAsync(fileBytes);
        });

        app.MapPost("/api/upload", async (HttpContext context) =>
        {
            var form = await context.Request.ReadFormAsync();
            var file = form.Files.GetFile("file");

            if (file == null || file.Length == 0)
            {
                await WriteErrorAsync(context, 400, "No file provided");
                return;
            }

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".aml" && ext != ".xml")
            {
                await WriteErrorAsync(context, 400, "Only .aml or .xml files are accepted");
                return;
            }

            string content;
            using (var reader = new StreamReader(file.OpenReadStream()))
                content = await reader.ReadToEndAsync();

            try { XDocument.Parse(content); }
            catch (XmlException)
            {
                await WriteErrorAsync(context, 400, "Invalid XML file");
                return;
            }

            if (File.Exists(amlFilePath))
                File.Copy(amlFilePath, amlFilePath + ".bak", overwrite: true);

            await File.WriteAllTextAsync(amlFilePath, content);
            await WriteSuccessAsync(context);
        });

        app.MapPost("/api/reset", async (HttpContext context) =>
        {
            if (!File.Exists(templateFilePath))
            {
                await WriteErrorAsync(context, 404, "Template file not found");
                return;
            }

            if (File.Exists(amlFilePath))
                File.Copy(amlFilePath, amlFilePath + ".bak", overwrite: true);

            File.Copy(templateFilePath, amlFilePath, overwrite: true);
            ExternalReferenceResolver.ResolveExternalReferences(amlFilePath, logger);
            await WriteSuccessAsync(context);
        });
    }

    // -------------------------------------------------------------------------
    // Response helpers
    // -------------------------------------------------------------------------

    private static Task WriteSuccessAsync(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(new { status = "success" }));
    }

    private static Task WriteErrorAsync(HttpContext context, int statusCode, string message)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
    }
}
