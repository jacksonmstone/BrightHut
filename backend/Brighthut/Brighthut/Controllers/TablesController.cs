using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace Brighthut.Controllers;

[ApiController]
[Route("api")]
public class TablesController : ControllerBase
{
    private readonly SqliteDataService _db;

    private static readonly HashSet<string> PublicReadableTables =
    [
        "public_impact_snapshots",
        "safehouse_monthly_metrics",
        // Anonymous totals / progress on the public site (landing + Impact); no per-donor filtering.
        "donations",
        // Public marketing feed on /social (same content shown to staff).
        "social_media_posts",
    ];

    private static readonly HashSet<string> DonorReadableTables =
    [
        "supporters",
        "donations",
        "donation_allocations",
        "in_kind_donation_items",
    ];

    public TablesController(SqliteDataService db)
    {
        _db = db;
    }

    /// <summary>JSON rows for a whitelisted table (see OpenAPI description on 404).</summary>
    [AllowAnonymous]
    [HttpGet("tables/{tableName}")]
    [ProducesResponseType(typeof(IReadOnlyList<Dictionary<string, object?>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public IActionResult GetTable(string tableName)
    {
        if (!_db.IsTableAllowed(tableName))
            return NotFound(new { error = "Unknown table name.", allowed = "GET /api/tables/{name} with a valid table." });

        try
        {
            if (PublicReadableTables.Contains(tableName))
            {
                return Ok(_db.QueryAll(tableName));
            }

            if (User.Identity?.IsAuthenticated != true)
            {
                return Unauthorized(new { error = "Authentication required." });
            }

            var role = User.FindFirstValue(ClaimTypes.Role)?.Trim().ToLowerInvariant();
            var email = User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue("email")
                ?? User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");

            if (role is "staff" or "admin")
            {
                return Ok(_db.QueryAll(tableName));
            }

            if (role == "donor")
            {
                if (string.IsNullOrWhiteSpace(email))
                    return Forbid();

                if (!DonorReadableTables.Contains(tableName))
                    return Forbid();

                var normalizedEmail = email.Trim().ToLowerInvariant();
                return tableName switch
                {
                    "supporters" => Ok(_db.QuerySupporterByEmail(normalizedEmail)),
                    "donations" => Ok(_db.QueryDonationsBySupporterEmail(normalizedEmail)),
                    "donation_allocations" => Ok(_db.QueryDonationAllocationsBySupporterEmail(normalizedEmail)),
                    "in_kind_donation_items" => Ok(_db.QueryInKindItemsBySupporterEmail(normalizedEmail)),
                    _ => Forbid(),
                };
            }

            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    [HttpPost("tables/{tableName}")]
    [Authorize(Roles = "admin,staff")]
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
    [Authorize(Roles = "admin")]
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

    [HttpDelete("tables/{tableName}/{id:long}")]
    [Authorize(Roles = "admin,staff")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult DeleteRow(string tableName, long id, [FromQuery] bool confirm = false)
    {
        if (!confirm)
            return BadRequest(new { error = "Deletion requires confirmation. Pass ?confirm=true." });

        if (!_db.IsTableAllowed(tableName))
            return NotFound(new { error = "Unknown table name." });

        var ok = _db.Delete(tableName, id);
        if (!ok)
            return NotFound(new { error = "Record not found." });

        return Ok(new { id, deleted = true });
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
