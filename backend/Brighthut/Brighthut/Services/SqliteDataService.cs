using Microsoft.Data.Sqlite;

namespace Brighthut.Services;

public sealed class SqliteDataService
{
    private readonly string _dbPath;

    private static readonly HashSet<string> AllowedTables =
    [
        "safehouses",
        "partners",
        "partner_assignments",
        "supporters",
        "social_media_posts",
        "donations",
        "in_kind_donation_items",
        "donation_allocations",
        "residents",
        "process_recordings",
        "home_visitations",
        "education_records",
        "health_wellbeing_records",
        "intervention_plans",
        "incident_reports",
        "safehouse_monthly_metrics",
        "public_impact_snapshots",
    ];

    public SqliteDataService()
    {
        _dbPath = Path.Combine(AppContext.BaseDirectory, "brighthut.sqlite");
    }

    public bool IsTableAllowed(string tableName) =>
        AllowedTables.Contains(tableName, StringComparer.Ordinal);

    public IReadOnlyList<Dictionary<string, object?>> QueryAll(string tableName)
    {
        if (!IsTableAllowed(tableName))
        {
            throw new ArgumentException("Unknown table.", nameof(tableName));
        }

        if (!File.Exists(_dbPath))
        {
            throw new InvalidOperationException(
                $"SQLite database not found at {_dbPath}. Ensure brighthut.sqlite is copied to the output directory.");
        }

        var results = new List<Dictionary<string, object?>>();
        using var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT * FROM {tableName}";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }

            results.Add(row);
        }

        return results;
    }
}
