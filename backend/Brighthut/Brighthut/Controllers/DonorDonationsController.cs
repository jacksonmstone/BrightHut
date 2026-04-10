using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Brighthut.Controllers;

[ApiController]
[Route("api/donor")]
public class DonorDonationsController : ControllerBase
{
    private readonly SqliteDataService _db;

    /// <summary>Matches frontend display conversion for Monetary gifts stored in PHP.</summary>
    private const decimal PhpPerUsd = 56m;

    public DonorDonationsController(SqliteDataService db)
    {
        _db = db;
    }

    public sealed record CreateDonorDonationRequest(decimal AmountUsd, string? Notes, string? CampaignName, string? DonationDate);

    /// <summary>Record a demo monetary gift tied to the logged-in donor (no real payment processor).</summary>
    [Authorize(Roles = "donor")]
    [HttpPost("donations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult CreateDonation([FromBody] CreateDonorDonationRequest req)
    {
        if (req.AmountUsd <= 0 || req.AmountUsd > 1_000_000m)
            return BadRequest(new { error = "Enter an amount between 0 and 1,000,000 USD." });

        var email = User.FindFirstValue(ClaimTypes.Email)?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email))
            return Unauthorized(new { error = "Email claim missing from token." });

        var (fn, ln) = _db.GetUserNamesByEmail(email);
        var supporterId = _db.EnsureSupporterForDonorEmail(email, fn, ln);
        var amountPhp = Math.Round(req.AmountUsd * PhpPerUsd, 2);
        // Prefer the client's local date (avoids UTC vs local timezone off-by-one)
        var today = !string.IsNullOrWhiteSpace(req.DonationDate)
            && System.DateTime.TryParseExact(req.DonationDate, "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out _)
            ? req.DonationDate
            : DateTime.UtcNow.ToString("yyyy-MM-dd");
        var campaign = string.IsNullOrWhiteSpace(req.CampaignName) ? "Online Giving" : req.CampaignName.Trim();
        var notes = string.IsNullOrWhiteSpace(req.Notes)
            ? "Recorded via donor dashboard (demo gift; not a live payment)."
            : req.Notes.Trim();

        var id = _db.Insert(
            "donations",
            new Dictionary<string, object?>
            {
                ["supporter_id"] = supporterId,
                ["donation_type"] = "Monetary",
                ["donation_date"] = today,
                ["channel_source"] = "Direct",
                ["currency_code"] = "PHP",
                ["amount"] = (double)amountPhp,
                ["impact_unit"] = "pesos",
                ["is_recurring"] = 0L,
                ["campaign_name"] = campaign,
                ["notes"] = notes,
            });

        return Ok(new { donation_id = id, amount_php = amountPhp, amount_usd = req.AmountUsd });
    }
}
