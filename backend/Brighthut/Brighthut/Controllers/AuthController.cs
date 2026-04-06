using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Brighthut.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly string _connStr;

    public AuthController(IConfiguration config)
    {
        _config = config;
        _connStr = $"Data Source={Path.Combine(AppContext.BaseDirectory, "brighthut.sqlite")}";
    }

    // POST /api/auth/register
    [HttpPost("register")]
    public IActionResult Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        if (req.Password.Length < 8)
            return BadRequest(new { error = "Password must be at least 8 characters." });

        var hash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        using var conn = new SqliteConnection(_connStr);
        conn.Open();

        // Check if email already exists
        using var check = conn.CreateCommand();
        check.CommandText = "SELECT COUNT(*) FROM users WHERE email = @email";
        check.Parameters.AddWithValue("@email", req.Email.ToLower());
        var exists = (long)(check.ExecuteScalar() ?? 0L);
        if (exists > 0)
            return Conflict(new { error = "An account with that email already exists." });

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO users
              (email, password_hash, role, first_name, last_name, organization_name,
               phone, country, region, relationship_type, acquisition_channel, supporter_type)
            VALUES
              (@email, @hash, @role, @firstName, @lastName, @orgName,
               @phone, @country, @region, @relType, @acqChannel, @suppType);
            SELECT last_insert_rowid();";

        cmd.Parameters.AddWithValue("@email", req.Email.ToLower());
        cmd.Parameters.AddWithValue("@hash", hash);
        cmd.Parameters.AddWithValue("@role", "donor");
        cmd.Parameters.AddWithValue("@firstName", req.FirstName ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@lastName", req.LastName ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@orgName", req.OrganizationName ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@phone", req.Phone ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@country", req.Country ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@region", req.Region ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@relType", req.RelationshipType ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@acqChannel", req.AcquisitionChannel ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@suppType", req.SupporterType ?? (object)DBNull.Value);

        var newId = (long)(cmd.ExecuteScalar() ?? 0L);
        var token = GenerateToken(newId, req.Email.ToLower(), "donor");

        return Ok(new { token, role = "donor", email = req.Email.ToLower() });
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        using var conn = new SqliteConnection(_connStr);
        conn.Open();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT user_id, password_hash, role, is_active FROM users WHERE email = @email";
        cmd.Parameters.AddWithValue("@email", req.Email.ToLower());

        using var reader = cmd.ExecuteReader();
        if (!reader.Read())
            return Unauthorized(new { error = "Invalid email or password." });

        var userId = reader.GetInt64(0);
        var storedHash = reader.GetString(1);
        var role = reader.GetString(2);
        var isActive = reader.GetInt64(3);

        if (isActive == 0)
            return Unauthorized(new { error = "Account is inactive." });

        if (!BCrypt.Net.BCrypt.Verify(req.Password, storedHash))
            return Unauthorized(new { error = "Invalid email or password." });

        var token = GenerateToken(userId, req.Email.ToLower(), role);
        return Ok(new { token, role, email = req.Email.ToLower() });
    }

    private string GenerateToken(long userId, string email, string role)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddHours(double.Parse(_config["Jwt:ExpiryHours"]!));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(ClaimTypes.Role, role),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record RegisterRequest(
    string Email,
    string Password,
    string? FirstName,
    string? LastName,
    string? OrganizationName,
    string? Phone,
    string? Country,
    string? Region,
    string? RelationshipType,
    string? AcquisitionChannel,
    string? SupporterType
);

public record LoginRequest(string Email, string Password);
