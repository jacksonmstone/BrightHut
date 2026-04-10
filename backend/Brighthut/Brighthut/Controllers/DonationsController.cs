using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Brighthut.Controllers;

[ApiController]
[Route("api/donations")]
public class DonationsController : ControllerBase
{
    private readonly DbConnectionFactory _factory;

    public DonationsController(DbConnectionFactory factory)
    {
        _factory = factory;
    }

    public record SubmitDonationRequest(decimal AmountUsd, string? Note, string? DonationDate);

    // POST /api/donations/submit  — donor self-service placeholder payment
    [HttpPost("submit")]
    [Authorize(Roles = "donor,staff,admin")]
    public IActionResult Submit([FromBody] SubmitDonationRequest req)
    {
        var email = User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue("email")
            ?? User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");

        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Could not determine donor email from token." });

        if (req.AmountUsd <= 0)
            return BadRequest(new { error = "Amount must be greater than zero." });

        var amountPhp = Math.Round(req.AmountUsd * 56m, 2);
        // Prefer the client's local date (avoids UTC vs local timezone off-by-one)
        var today = !string.IsNullOrWhiteSpace(req.DonationDate)
            && System.DateTime.TryParseExact(req.DonationDate, "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out _)
            ? req.DonationDate
            : DateTime.UtcNow.ToString("yyyy-MM-dd");
        var normalizedEmail = email.Trim().ToLowerInvariant();

        using var conn = _factory.CreateConnection();
        conn.Open();

        // Find or create a supporter record linked to this email
        long supporterId;
        using (var findCmd = conn.CreateCommand())
        {
            findCmd.CommandText = _factory.OneRow("SELECT supporter_id FROM supporters WHERE LOWER(email) = @email");
            DbConnectionFactory.Bind(findCmd, "@email", normalizedEmail);
            var result = findCmd.ExecuteScalar();
            if (result is not null)
            {
                supporterId = Convert.ToInt64(result);
            }
            else
            {
                using var insertCmd = conn.CreateCommand();
                var namePart = normalizedEmail.Split('@')[0];
                var displayName = char.ToUpper(namePart[0]) + namePart[1..];
                insertCmd.CommandText = $@"
                    INSERT INTO supporters (display_name, email, supporter_type, relationship_type, status, first_donation_date)
                    VALUES (@display, @email, 'MonetaryDonor', 'Local', 'Active', @today);
                    {_factory.LastInsertIdSql}";
                DbConnectionFactory.Bind(insertCmd, "@display", displayName);
                DbConnectionFactory.Bind(insertCmd, "@email", normalizedEmail);
                DbConnectionFactory.Bind(insertCmd, "@today", today);
                supporterId = Convert.ToInt64(insertCmd.ExecuteScalar() ?? 0L);
            }
        }

        long donationId;
        using (var donCmd = conn.CreateCommand())
        {
            donCmd.CommandText = $@"
                INSERT INTO donations
                  (supporter_id, donation_type, donation_date, channel_source,
                   amount, currency_code, impact_unit, is_recurring, campaign_name, notes)
                VALUES
                  (@sid, 'Monetary', @date, 'Direct',
                   @amount, 'PHP', 'pesos', 0, 'Online Donation', @notes);
                {_factory.LastInsertIdSql}";
            DbConnectionFactory.Bind(donCmd, "@sid", supporterId);
            DbConnectionFactory.Bind(donCmd, "@date", today);
            DbConnectionFactory.Bind(donCmd, "@amount", (double)amountPhp);
            DbConnectionFactory.Bind(donCmd, "@notes", req.Note);
            donationId = Convert.ToInt64(donCmd.ExecuteScalar() ?? 0L);
        }

        return Ok(new { donationId, supporterId, amountPhp });
    }
}
