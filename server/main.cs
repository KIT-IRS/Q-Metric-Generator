using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

const string AmlFilePath = "Q-Metrics.aml";
const string TemplateFilePath = "Q-Metrics_template.aml";

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options =>
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors("AllowAll"); // TODO: restrict in production

var logLevel = (Environment.GetEnvironmentVariable("LOG_LEVEL") ?? "Information").ToLower() switch
{
    "trace" => LogLevel.Trace,
    "debug" => LogLevel.Debug,
    "warning" => LogLevel.Warning,
    "error" => LogLevel.Error,
    "critical" => LogLevel.Critical,
    _ => LogLevel.Information
};

var loggerFactory = LoggerFactory.Create(b => b.AddConsole().SetMinimumLevel(logLevel));
var logger = loggerFactory.CreateLogger("AmlEditor");

// Create working file from template if it doesn't exist (e.g. fresh container)
if (!File.Exists(AmlFilePath) && File.Exists(TemplateFilePath))
{
    File.Copy(TemplateFilePath, AmlFilePath);
    logger.LogInformation("Created working file from template: {Path}", AmlFilePath);
}

// Resolve external references (e.g. intent_semantics constraints) from concept server on startup
ExternalReferenceResolver.ResolveExternalReferences(AmlFilePath, logger);

app.MapAmlEndpoints(AmlFilePath, TemplateFilePath, logger);
app.Run("http://0.0.0.0:8080");
