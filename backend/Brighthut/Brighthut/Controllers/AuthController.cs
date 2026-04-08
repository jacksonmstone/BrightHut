using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
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
        _connStr = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
    }

    // POST /api/auth/register
    [AllowAnonymous]
    [HttpPost("register")]
    public IActionResult Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        var passwordError = ValidatePasswordPolicy(req.Password, req.Email);
        if (passwordError is not null)
            return BadRequest(new { error = passwordError });

        var hash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        using var conn = new SqlConnection(_connStr);
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
            SELECT SCOPE_IDENTITY();";

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

        return Ok(new { token, role = "donor", email = req.Email.ToLower(), firstName = req.FirstName });
    }

    private static string? ValidatePasswordPolicy(string password, string email)
    {
        if (password.Length < 12)
            return "Password must be at least 12 characters.";

        if (!password.Any(char.IsUpper))
            return "Password must include at least one uppercase letter.";

        if (!password.Any(char.IsLower))
            return "Password must include at least one lowercase letter.";

        if (!password.Any(char.IsDigit))
            return "Password must include at least one number.";

        if (!password.Any(ch => !char.IsLetterOrDigit(ch)))
            return "Password must include at least one special character.";

        if (password.Any(char.IsWhiteSpace))
            return "Password cannot contain spaces.";

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var localPart = normalizedEmail.Split('@')[0];
        if (!string.IsNullOrWhiteSpace(localPart) && password.ToLowerInvariant().Contains(localPart))
            return "Password cannot contain your email name.";

        return null;
    }

    // POST /api/auth/login
    [AllowAnonymous]
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        using var conn = new SqlConnection(_connStr);
        conn.Open();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT user_id, password_hash, role, is_active, first_name FROM users WHERE email = @email";
        cmd.Parameters.AddWithValue("@email", req.Email.ToLower());

        using var reader = cmd.ExecuteReader();
        if (!reader.Read())
            return Unauthorized(new { error = "Invalid email or password." });

        var userId = Convert.ToInt64(reader.GetValue(0));
        var storedHash = reader.GetString(1);
        var role = reader.GetString(2);
        var isActive = Convert.ToInt64(reader.GetValue(3));
        var firstName = reader.IsDBNull(4) ? null : reader.GetString(4);

        if (isActive == 0)
            return Unauthorized(new { error = "Account is inactive." });

        if (!BCrypt.Net.BCrypt.Verify(req.Password, storedHash))
            return Unauthorized(new { error = "Invalid email or password." });

        var token = GenerateToken(userId, req.Email.ToLower(), role);
        return Ok(new { token, role, email = req.Email.ToLower(), firstName });
    }

    // GET /api/auth/me
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var email = User.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? User.FindFirstValue(ClaimTypes.Email);
        var role = User.FindFirstValue(ClaimTypes.Role);

        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(role))
            return Unauthorized(new { error = "Invalid token claims." });

        return Ok(new { userId, email, role });
    }

    // GET /api/auth/users  (staff/admin only)
    [HttpGet("users")]
    [Authorize(Roles = "staff,admin")]
    public IActionResult GetUsers()
    {
        using var conn = new SqlConnection(_connStr);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT user_id, email, role, first_name, last_name, organization_name, phone, country, region, supporter_type, created_at, is_active FROM users ORDER BY created_at DESC";
        using var reader = cmd.ExecuteReader();
        var users = new List<object>();
        while (reader.Read())
        {
            users.Add(new
            {
                user_id         = Convert.ToInt64(reader.GetValue(0)),
                email           = reader.IsDBNull(1)  ? null : reader.GetString(1),
                role            = reader.IsDBNull(2)  ? null : reader.GetString(2),
                first_name      = reader.IsDBNull(3)  ? null : reader.GetString(3),
                last_name       = reader.IsDBNull(4)  ? null : reader.GetString(4),
                organization    = reader.IsDBNull(5)  ? null : reader.GetString(5),
                phone           = reader.IsDBNull(6)  ? null : reader.GetString(6),
                country         = reader.IsDBNull(7)  ? null : reader.GetString(7),
                region          = reader.IsDBNull(8)  ? null : reader.GetString(8),
                supporter_type  = reader.IsDBNull(9)  ? null : reader.GetString(9),
                created_at      = reader.IsDBNull(10) ? null : reader.GetString(10),
                is_active       = Convert.ToInt64(reader.GetValue(11)) == 1,
            });
        }
        return Ok(users);
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
