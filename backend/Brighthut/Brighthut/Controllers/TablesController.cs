using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Brighthut.Controllers;

[ApiController]
[Route("api")]
public class TablesController : ControllerBase
{
    private readonly SqliteDataService _db;

    public TablesController(SqliteDataService db)
    {
        _db = db;
    }

    [HttpGet("tables/{tableName}")]
    [ProducesResponseType(typeof(IReadOnlyList<Dictionary<string, object?>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetTable(string tableName)
    {
        if (!_db.IsTableAllowed(tableName))
            return NotFound(new { error = "Unknown table name.", allowed = "GET /api/tables/{name} with a valid table." });

        try
        {
            return Ok(_db.QueryAll(tableName));
        }
        catch (InvalidOperationException ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    [HttpPost("tables/{tableName}")]
    [Authorize(Roles = "staff")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult InsertRow(string tableName, [FromBody] Dictionary<string, JsonElement> body)
    {
        if (!_db.IsTableAllowed(tableName))
            return NotFound(new { error = "Unknown table name." });

        try
        {
            var data = body.ToDictionary(k => k.Key, k => ConvertJsonElement(k.Value));
            var newId = _db.Insert(tableName, data);
            return Ok(new { id = newId });
        }
        catch (Exception ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    [HttpPut("tables/{tableName}/{id:long}")]
    [Authorize(Roles = "staff")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult UpdateRow(string tableName, long id, [FromBody] Dictionary<string, JsonElement> body)
    {
        if (!_db.IsTableAllowed(tableName))
            return NotFound(new { error = "Unknown table name." });

        try
        {
            var data = body.ToDictionary(k => k.Key, k => ConvertJsonElement(k.Value));
            var ok = _db.Update(tableName, id, data);
            return ok ? NoContent() : NotFound(new { error = "Record not found." });
        }
        catch (Exception ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private static object? ConvertJsonElement(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.TryGetInt64(out var l) ? (object)l : el.GetDouble(),
        JsonValueKind.True => (object)1L,
        JsonValueKind.False => 0L,
        JsonValueKind.Null => null,
        _ => el.ToString(),
    };
}
