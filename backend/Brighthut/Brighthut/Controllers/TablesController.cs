using Brighthut.Services;
using Microsoft.AspNetCore.Mvc;

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

    /// <summary>JSON rows for a whitelisted table (see OpenAPI description on 404).</summary>
    [HttpGet("tables/{tableName}")]
    [ProducesResponseType(typeof(IReadOnlyList<Dictionary<string, object?>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetTable(string tableName)
    {
        if (!_db.IsTableAllowed(tableName))
        {
            return NotFound(new { error = "Unknown table name.", allowed = "GET /api/tables/{name} with a valid table." });
        }

        try
        {
            return Ok(_db.QueryAll(tableName));
        }
        catch (InvalidOperationException ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}
