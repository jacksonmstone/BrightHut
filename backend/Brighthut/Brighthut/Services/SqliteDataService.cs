using System.Data;

namespace Brighthut.Services;

public sealed class SqliteDataService
{
    private readonly DbConnectionFactory _factory;

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

    private static readonly Dictionary<string, string> PrimaryKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        ["safehouses"] = "safehouse_id",
        ["partners"] = "partner_id",
        ["partner_assignments"] = "assignment_id",
        ["supporters"] = "supporter_id",
        ["social_media_posts"] = "post_id",
        ["donations"] = "donation_id",
        ["in_kind_donation_items"] = "item_id",
        ["donation_allocations"] = "allocation_id",
        ["residents"] = "resident_id",
        ["process_recordings"] = "recording_id",
        ["home_visitations"] = "visitation_id",
        ["education_records"] = "education_record_id",
        ["health_wellbeing_records"] = "health_record_id",
        ["intervention_plans"] = "plan_id",
        ["incident_reports"] = "incident_id",
        ["safehouse_monthly_metrics"] = "metric_id",
        ["public_impact_snapshots"] = "snapshot_id",
    };

    public SqliteDataService(DbConnectionFactory factory)
    {
        _factory = factory;
    }

    public bool IsTableAllowed(string tableName) =>
        AllowedTables.Contains(tableName, StringComparer.Ordinal);

    public string GetPrimaryKey(string tableName) =>
        PrimaryKeys.TryGetValue(tableName, out var pk) ? pk : throw new ArgumentException("Unknown table.", nameof(tableName));

    public IReadOnlyList<Dictionary<string, object?>> QueryAll(string tableName)
    {
        if (!IsTableAllowed(tableName))
            throw new ArgumentException("Unknown table.", nameof(tableName));

        var results = new List<Dictionary<string, object?>>();
        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT * FROM {tableName}";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            results.Add(row);
        }
        return results;
    }

    public long Insert(string tableName, Dictionary<string, object?> data)
    {
        if (!IsTableAllowed(tableName)) throw new ArgumentException("Unknown table.", nameof(tableName));

        var pk = GetPrimaryKey(tableName);
        data.Remove(pk);

        var columns = data.Keys.ToList();
        var paramNames = columns.Select((_, i) => $"@p{i}").ToList();

        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"INSERT INTO {tableName} ({string.Join(", ", columns)}) VALUES ({string.Join(", ", paramNames)}); {_factory.LastInsertIdSql}";
        for (var i = 0; i < columns.Count; i++)
            DbConnectionFactory.Bind(cmd, $"@p{i}", data[columns[i]]);

        return Convert.ToInt64(cmd.ExecuteScalar() ?? 0L);
    }

    public IReadOnlyList<Dictionary<string, object?>> QuerySupporterByEmail(string email)
    {
        var sql = _factory.OneRow("SELECT * FROM supporters WHERE LOWER(email) = @email");
        return QueryWithParameters(sql, cmd => DbConnectionFactory.Bind(cmd, "@email", email.Trim().ToLowerInvariant()));
    }

    public IReadOnlyList<Dictionary<string, object?>> QueryDonationsBySupporterEmail(string email)
    {
        const string sql = @"
            SELECT d.*
            FROM donations d
            INNER JOIN supporters s ON s.supporter_id = d.supporter_id
            WHERE LOWER(s.email) = @email
            ORDER BY d.donation_date DESC;";

        return QueryWithParameters(sql, cmd => DbConnectionFactory.Bind(cmd, "@email", email.Trim().ToLowerInvariant()));
    }

    public IReadOnlyList<Dictionary<string, object?>> QueryDonationAllocationsBySupporterEmail(string email)
    {
        const string sql = @"
            SELECT a.*
            FROM donation_allocations a
            INNER JOIN donations d ON d.donation_id = a.donation_id
            INNER JOIN supporters s ON s.supporter_id = d.supporter_id
            WHERE LOWER(s.email) = @email
            ORDER BY a.allocation_date DESC;";

        return QueryWithParameters(sql, cmd => DbConnectionFactory.Bind(cmd, "@email", email.Trim().ToLowerInvariant()));
    }

    public IReadOnlyList<Dictionary<string, object?>> QueryInKindItemsBySupporterEmail(string email)
    {
        const string sql = @"
            SELECT i.*
            FROM in_kind_donation_items i
            INNER JOIN donations d ON d.donation_id = i.donation_id
            INNER JOIN supporters s ON s.supporter_id = d.supporter_id
            WHERE LOWER(s.email) = @email
            ORDER BY d.donation_date DESC, i.item_id DESC;";

        return QueryWithParameters(sql, cmd => DbConnectionFactory.Bind(cmd, "@email", email.Trim().ToLowerInvariant()));
    }

    public bool Update(string tableName, long id, Dictionary<string, object?> data)
    {
        if (!IsTableAllowed(tableName)) throw new ArgumentException("Unknown table.", nameof(tableName));

        var pk = GetPrimaryKey(tableName);
        data.Remove(pk);

        var columns = data.Keys.ToList();
        var setClauses = columns.Select((c, i) => $"{c} = @p{i}").ToList();

        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"UPDATE {tableName} SET {string.Join(", ", setClauses)} WHERE {pk} = @id";
        for (var i = 0; i < columns.Count; i++)
            DbConnectionFactory.Bind(cmd, $"@p{i}", data[columns[i]]);
        DbConnectionFactory.Bind(cmd, "@id", id);

        return cmd.ExecuteNonQuery() > 0;
    }

    public bool Delete(string tableName, long id)
    {
        if (!IsTableAllowed(tableName)) throw new ArgumentException("Unknown table.", nameof(tableName));

        var pk = GetPrimaryKey(tableName);

        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DELETE FROM {tableName} WHERE {pk} = @id";
        DbConnectionFactory.Bind(cmd, "@id", id);

        return cmd.ExecuteNonQuery() > 0;
    }

    private IReadOnlyList<Dictionary<string, object?>> QueryWithParameters(string sql, Action<IDbCommand> bindParameters)
    {
        var results = new List<Dictionary<string, object?>>();
        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        bindParameters(cmd);
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            results.Add(row);
        }
        return results;
    }

    public (string? FirstName, string? LastName) GetUserNamesByEmail(string email)
    {
        var sql = _factory.OneRow("SELECT first_name, last_name FROM users WHERE LOWER(email) = LOWER(@email)");
        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        DbConnectionFactory.Bind(cmd, "@email", email.Trim());
        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return (null, null);
        return (reader.IsDBNull(0) ? null : reader.GetString(0), reader.IsDBNull(1) ? null : reader.GetString(1));
    }

    public long EnsureSupporterForDonorEmail(string email, string? firstName, string? lastName)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var existing = QuerySupporterByEmail(normalized);
        if (existing.Count > 0)
            return Convert.ToInt64(existing[0]["supporter_id"] ?? 0L);

        var display = string.Join(" ", new[] { firstName, lastName }.Where(static s => !string.IsNullOrWhiteSpace(s)));
        if (string.IsNullOrWhiteSpace(display))
            display = normalized.Split('@')[0];

        return Insert("supporters", new Dictionary<string, object?>
        {
            ["supporter_type"] = "MonetaryDonor",
            ["display_name"] = display,
            ["first_name"] = firstName,
            ["last_name"] = lastName,
            ["relationship_type"] = "Local",
            ["email"] = normalized,
            ["status"] = "Active",
            ["acquisition_channel"] = "Website",
        });
    }
}
