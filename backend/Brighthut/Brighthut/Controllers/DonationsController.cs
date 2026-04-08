using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Security.Claims;

namespace Brighthut.Controllers;

[ApiController]
[Route("api/donations")]
public class DonationsController : ControllerBase
{
    private readonly string _connStr;

    public DonationsController(SqliteDataService _, IConfiguration config)
    {
        _connStr = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
    }

    public record SubmitDonationRequest(decimal AmountUsd, string? Note);

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

        // PHP conversion (1 USD ≈ 56 PHP)
        var amountPhp = Math.Round(req.AmountUsd * 56m, 2);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var normalizedEmail = email.Trim().ToLowerInvariant();

        using var conn = new SqlConnection(_connStr);
        conn.Open();

        // Find or create a supporter record linked to this email
        long supporterId;
        using (var findCmd = conn.CreateCommand())
        {
            findCmd.CommandText = "SELECT TOP 1 supporter_id FROM supporters WHERE LOWER(email) = @email";
            findCmd.Parameters.AddWithValue("@email", normalizedEmail);
            var result = findCmd.ExecuteScalar();
            if (result is not null)
            {
                supporterId = Convert.ToInt64(result);
            }
            else
            {
                // Create a minimal supporter record for this donor
                using var insertCmd = conn.CreateCommand();
                var namePart = normalizedEmail.Split('@')[0];
                var displayName = char.ToUpper(namePart[0]) + namePart[1..];
                insertCmd.CommandText = @"
                    INSERT INTO supporters (display_name, email, supporter_type, relationship_type, status, first_donation_date)
                    VALUES (@display, @email, 'MonetaryDonor', 'Local', 'Active', @today);
                    SELECT SCOPE_IDENTITY();";
                insertCmd.Parameters.AddWithValue("@display", displayName);
                insertCmd.Parameters.AddWithValue("@email", normalizedEmail);
                insertCmd.Parameters.AddWithValue("@today", today);
                supporterId = Convert.ToInt64(insertCmd.ExecuteScalar() ?? 0L);
            }
        }

        // Insert the donation
        long donationId;
        using (var donCmd = conn.CreateCommand())
        {
            donCmd.CommandText = @"
                INSERT INTO donations
                  (supporter_id, donation_type, donation_date, channel_source,
                   amount, currency_code, impact_unit, is_recurring, campaign_name, notes)
                VALUES
                  (@sid, 'Monetary', @date, 'Direct',
                   @amount, 'PHP', 'pesos', 0, 'Online Donation', @notes);
                SELECT SCOPE_IDENTITY();";
            donCmd.Parameters.AddWithValue("@sid", supporterId);
            donCmd.Parameters.AddWithValue("@date", today);
            donCmd.Parameters.AddWithValue("@amount", (double)amountPhp);
            donCmd.Parameters.AddWithValue("@notes", (object?)req.Note ?? DBNull.Value);
            donationId = Convert.ToInt64(donCmd.ExecuteScalar() ?? 0L);
        }

        return Ok(new { donationId, supporterId, amountPhp });
    }
}
