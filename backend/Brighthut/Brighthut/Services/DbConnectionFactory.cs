using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using System.Data;
using System.Text.RegularExpressions;

namespace Brighthut.Services;

/// <summary>
/// Creates the correct database connection based on the connection string.
/// "Data Source=..." → SQLite (local dev).
/// Everything else → Azure SQL (production).
/// </summary>
public sealed class DbConnectionFactory
{
    private readonly string _connStr;
    public readonly bool IsSqlite;

    public DbConnectionFactory(IConfiguration config)
    {
        _connStr = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection is not configured. " +
                "Set it in appsettings.Development.json for local dev or " +
                "CONNECTIONSTRINGS__DEFAULTCONNECTION in Azure App Service Configuration for production.");

        IsSqlite = _connStr.TrimStart().StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase)
                   && !_connStr.Contains(".database.windows.net", StringComparison.OrdinalIgnoreCase);
    }

    public IDbConnection CreateConnection() =>
        IsSqlite ? new SqliteConnection(_connStr) : new SqlConnection(_connStr);

    /// <summary>SQL fragment to retrieve the last auto-generated row ID.</summary>
    public string LastInsertIdSql => IsSqlite ? "SELECT last_insert_rowid();" : "SELECT SCOPE_IDENTITY();";

    /// <summary>Rewrites a SELECT to return only one row using the correct dialect.</summary>
    public string OneRow(string sql)
    {
        if (IsSqlite)
        {
            // Remove any TOP n that was written for SQL Server, then append LIMIT 1
            var cleaned = Regex.Replace(sql.Trim(), @"(?i)SELECT\s+TOP\s+\d+\s+", "SELECT ", RegexOptions.None, TimeSpan.FromSeconds(1));
            return cleaned.TrimEnd(';') + " LIMIT 1;";
        }

        // SQL Server: ensure TOP 1 is present after SELECT
        if (!Regex.IsMatch(sql, @"(?i)SELECT\s+TOP\s+\d+", RegexOptions.None, TimeSpan.FromSeconds(1)))
            return Regex.Replace(sql.Trim(), @"(?i)^SELECT\s+", "SELECT TOP 1 ", RegexOptions.None, TimeSpan.FromSeconds(1));

        return sql;
    }

    /// <summary>Add a named parameter to a command in a dialect-agnostic way.</summary>
    public static void Bind(IDbCommand cmd, string name, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }
}
