using Microsoft.Data.Sqlite;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var dbPath = Path.Combine(AppContext.BaseDirectory, "brighthut.sqlite");

List<Dictionary<string, object?>> QueryAll(string table)
{
    var results = new List<Dictionary<string, object?>>();
    using var conn = new SqliteConnection($"Data Source={dbPath}");
    conn.Open();
    using var cmd = conn.CreateCommand();
    cmd.CommandText = $"SELECT * FROM {table}";
    using var reader = cmd.ExecuteReader();
    while (reader.Read())
    {
        var row = new Dictionary<string, object?>();
        for (int i = 0; i < reader.FieldCount; i++)
            row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        results.Add(row);
    }
    return results;
}

app.MapGet("/", () => new {
    message = "BrightHut API",
    endpoints = new[]
    {
        "/safehouses", "/residents", "/supporters", "/donations",
        "/partners", "/social-media-posts", "/education-records",
        "/health-records", "/intervention-plans", "/incident-reports",
        "/home-visitations", "/process-recordings", "/safehouse-metrics"
    }
});

app.MapGet("/safehouses", () => QueryAll("safehouses"));
app.MapGet("/residents", () => QueryAll("residents"));
app.MapGet("/supporters", () => QueryAll("supporters"));
app.MapGet("/donations", () => QueryAll("donations"));
app.MapGet("/partners", () => QueryAll("partners"));
app.MapGet("/social-media-posts", () => QueryAll("social_media_posts"));
app.MapGet("/education-records", () => QueryAll("education_records"));
app.MapGet("/health-records", () => QueryAll("health_wellbeing_records"));
app.MapGet("/intervention-plans", () => QueryAll("intervention_plans"));
app.MapGet("/incident-reports", () => QueryAll("incident_reports"));
app.MapGet("/home-visitations", () => QueryAll("home_visitations"));
app.MapGet("/process-recordings", () => QueryAll("process_recordings"));
app.MapGet("/safehouse-metrics", () => QueryAll("safehouse_monthly_metrics"));

app.Run();
