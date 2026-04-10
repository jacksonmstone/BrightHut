using Brighthut.Services;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;

namespace Brighthut.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly DbConnectionFactory _factory;

    public AuthController(IConfiguration config, DbConnectionFactory factory)
    {
        _config = config;
        _factory = factory;
        _factory = factory;
        EnsureTwoFactorColumns();
        EnsureGoogleAuthColumns();
    }

    private void EnsureTwoFactorColumns()
    {
        if (_factory.IsSqlite)
        {
            using var conn = _factory.CreateConnection();
            conn.Open();
            foreach (var (col, def) in new[]
            {
                ("two_factor_secret", "TEXT"),
                ("two_factor_enabled", "INTEGER NOT NULL DEFAULT 0"),
            })
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"ALTER TABLE users ADD COLUMN {col} {def}";
                try { cmd.ExecuteNonQuery(); } catch { }
            }
        }
        else
        {
            EnsureColumnSqlServer("users", "two_factor_secret", "NVARCHAR(MAX)");
            EnsureColumnSqlServer("users", "two_factor_enabled", "INT NOT NULL DEFAULT 0");
        }
    }

    private void EnsureGoogleAuthColumns()
    {
        if (_factory.IsSqlite)
        {
            using var conn = _factory.CreateConnection();
            conn.Open();
            foreach (var (col, def) in new[]
            {
                ("auth_provider", "TEXT NOT NULL DEFAULT 'local'"),
                ("google_sub", "TEXT"),
                ("google_profile_completed", "INTEGER NOT NULL DEFAULT 0"),
            })
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"ALTER TABLE users ADD COLUMN {col} {def}";
                try { cmd.ExecuteNonQuery(); } catch { }
            }
        }
        else
        {
            EnsureColumnSqlServer("users", "auth_provider", "NVARCHAR(50) NOT NULL DEFAULT 'local'");
            EnsureColumnSqlServer("users", "google_sub", "NVARCHAR(MAX)");
            EnsureColumnSqlServer("users", "google_profile_completed", "INT NOT NULL DEFAULT 0");
        }
    }

    private void EnsureColumnSqlServer(string table, string column, string definition)
    {
        try
        {
            using var conn = _factory.CreateConnection();
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID('{table}') AND name = '{column}'
                )
                    ALTER TABLE {table} ADD {column} {definition}";
            cmd.ExecuteNonQuery();
        }
        catch
        {
            // Column likely already exists or insufficient permissions; ignore.
        }
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

        using var conn = _factory.CreateConnection();
        conn.Open();

        // Check if email already exists
        using var check = conn.CreateCommand();
        check.CommandText = "SELECT COUNT(*) FROM users WHERE email = @email";
        DbConnectionFactory.Bind(check, "@email", req.Email.ToLower());
        var exists = Convert.ToInt64(check.ExecuteScalar() ?? 0L);
        if (exists > 0)
            return Conflict(new { error = "An account with that email already exists." });

        using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"
            INSERT INTO users
              (email, password_hash, role, first_name, last_name, organization_name,
               phone, country, region, relationship_type, acquisition_channel, supporter_type)
            VALUES
              (@email, @hash, @role, @firstName, @lastName, @orgName,
               @phone, @country, @region, @relType, @acqChannel, @suppType);
            {_factory.LastInsertIdSql}";

        DbConnectionFactory.Bind(cmd, "@email", req.Email.ToLower());
        DbConnectionFactory.Bind(cmd, "@hash", hash);
        DbConnectionFactory.Bind(cmd, "@role", "donor");
        DbConnectionFactory.Bind(cmd, "@firstName", req.FirstName);
        DbConnectionFactory.Bind(cmd, "@lastName", req.LastName);
        DbConnectionFactory.Bind(cmd, "@orgName", req.OrganizationName);
        DbConnectionFactory.Bind(cmd, "@phone", req.Phone);
        DbConnectionFactory.Bind(cmd, "@country", req.Country);
        DbConnectionFactory.Bind(cmd, "@region", req.Region);
        DbConnectionFactory.Bind(cmd, "@relType", req.RelationshipType);
        DbConnectionFactory.Bind(cmd, "@acqChannel", req.AcquisitionChannel);
        DbConnectionFactory.Bind(cmd, "@suppType", req.SupporterType);

        var newId = Convert.ToInt64(cmd.ExecuteScalar() ?? 0L);
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

        var localPart = email.Trim().ToLowerInvariant().Split('@')[0];
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

        using var conn = _factory.CreateConnection();
        conn.Open();

        // Step 1: core login check — only columns guaranteed to exist
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT user_id, password_hash, role, is_active, first_name FROM users WHERE email = @email";
        DbConnectionFactory.Bind(cmd, "@email", req.Email.ToLower());

        long userId;
        string storedHash;
        string role;
        long isActive;
        string? firstName;

        using (var reader = cmd.ExecuteReader())
        {
            if (!reader.Read())
                return Unauthorized(new { error = "Invalid email or password." });

            userId = Convert.ToInt64(reader.GetValue(0));
            storedHash = reader.GetString(1);
            role = reader.GetString(2);
            isActive = Convert.ToInt64(reader.GetValue(3));
            firstName = reader.IsDBNull(4) ? null : reader.GetString(4);
        }

        // Step 2: try to read 2FA columns (may not exist yet in SQL Server)
        bool twoFactorEnabled = false;
        string? twoFactorSecret = null;
        try
        {
            using var tfCmd = conn.CreateCommand();
            tfCmd.CommandText = "SELECT two_factor_enabled, two_factor_secret FROM users WHERE user_id = @id";
            DbConnectionFactory.Bind(tfCmd, "@id", userId);
            using var tfReader = tfCmd.ExecuteReader();
            if (tfReader.Read())
            {
                twoFactorEnabled = !tfReader.IsDBNull(0) && Convert.ToInt64(tfReader.GetValue(0)) == 1;
                twoFactorSecret = tfReader.IsDBNull(1) ? null : tfReader.GetString(1);
            }
        }
        catch
        {
            // 2FA columns not yet in DB — treat as disabled
        }

        if (isActive == 0)
            return Unauthorized(new { error = "Account is inactive." });

        if (!BCrypt.Net.BCrypt.Verify(req.Password, storedHash))
            return Unauthorized(new { error = "Invalid email or password." });

        var normalizedEmail = req.Email.Trim().ToLowerInvariant();

        if (!twoFactorEnabled && !IsTwoFactorEnrollmentExempt(normalizedEmail))
        {
            var setupToken = GenerateTwoFactorSetupToken(userId, normalizedEmail);
            return Ok(new
            {
                requires2faSetup = true,
                setupToken,
                email = normalizedEmail,
            });
        }

        if (twoFactorEnabled)
        {
            if (string.IsNullOrWhiteSpace(req.TwoFactorCode))
                return Ok(new { requires2fa = true, email = normalizedEmail });

            if (string.IsNullOrWhiteSpace(twoFactorSecret) || !VerifyTotpCode(twoFactorSecret, req.TwoFactorCode))
                return Unauthorized(new { error = "Invalid authentication code." });
        }

        var token = GenerateToken(userId, normalizedEmail, role);
        return Ok(new { token, role, email = normalizedEmail, firstName, requires2fa = false, requires2faSetup = false });
    }

    // POST /api/auth/google
    [AllowAnonymous]
    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IdToken))
            return BadRequest(new { error = "Google ID token is required." });

        if (!string.IsNullOrWhiteSpace(req.SupporterType) && !TryNormalizeSupporterType(req.SupporterType, out _))
            return BadRequest(new { error = "Invalid account type for Google sign-in." });

        var configuredGoogleClientId =
            Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID")
            ?? _config["GoogleAuth:ClientId"];

        if (string.IsNullOrWhiteSpace(configuredGoogleClientId))
            return Problem(
                detail: "Google sign-in is not configured on the server. Set GOOGLE_CLIENT_ID.",
                statusCode: StatusCodes.Status503ServiceUnavailable);

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                req.IdToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [configuredGoogleClientId],
                });
        }
        catch
        {
            return Unauthorized(new { error = "Invalid Google sign-in token." });
        }

        if (!payload.EmailVerified)
            return Unauthorized(new { error = "Google account email is not verified." });

        var normalizedEmail = payload.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
            return Unauthorized(new { error = "Google account email is missing." });

        var normalizedSupporterType = TryNormalizeSupporterType(req.SupporterType, out var supporterType)
            ? supporterType
            : null;

        var (userId, role, isActive, firstName, twoFactorEnabled, twoFactorSecret, requiresSupporterTypeSelection) =
            EnsureUserForGoogleLogin(normalizedEmail, payload.GivenName, payload.FamilyName, payload.Name, payload.Subject, normalizedSupporterType);

        if (requiresSupporterTypeSelection)
        {
            return Ok(new
            {
                requiresAccountTypeSelection = true,
                email = normalizedEmail,
                firstName,
            });
        }

        if (!isActive)
            return Unauthorized(new { error = "Account is inactive." });

        if (!twoFactorEnabled && !IsTwoFactorEnrollmentExempt(normalizedEmail))
        {
            var setupToken = GenerateTwoFactorSetupToken(userId, normalizedEmail);
            return Ok(new
            {
                requires2faSetup = true,
                setupToken,
                email = normalizedEmail,
            });
        }

        if (twoFactorEnabled)
        {
            if (string.IsNullOrWhiteSpace(req.TwoFactorCode))
                return Ok(new { requires2fa = true, email = normalizedEmail });

            if (string.IsNullOrWhiteSpace(twoFactorSecret) || !VerifyTotpCode(twoFactorSecret, req.TwoFactorCode))
                return Unauthorized(new { error = "Invalid authentication code." });
        }

        var token = GenerateToken(userId, normalizedEmail, role);
        return Ok(new
        {
            token,
            role,
            email = normalizedEmail,
            firstName,
            requires2fa = false,
            requires2faSetup = false,
        });
    }

    private (long UserId, string Role, bool IsActive, string? FirstName, bool TwoFactorEnabled, string? TwoFactorSecret, bool RequiresSupporterTypeSelection)
        EnsureUserForGoogleLogin(string email, string? givenName, string? familyName, string? displayName, string? googleSub, string? selectedSupporterType)
    {
        using var conn = _factory.CreateConnection();
        conn.Open();

        using (var find = conn.CreateCommand())
        {
            find.CommandText = _factory.OneRow(@"
                SELECT user_id, role, is_active, first_name, two_factor_enabled, two_factor_secret, supporter_type,
                       auth_provider, google_sub, google_profile_completed
                FROM users
                WHERE lower(email) = @email");
            DbConnectionFactory.Bind(find, "@email", email);

            using var reader = find.ExecuteReader();
            if (reader.Read())
            {
                var userId = reader.GetInt64(0);
                var role = reader.GetString(1);
                var isActive = reader.GetInt64(2) == 1;
                var firstName = reader.IsDBNull(3) ? null : reader.GetString(3);
                var twoFactorEnabled = !reader.IsDBNull(4) && reader.GetInt64(4) == 1;
                var twoFactorSecret = reader.IsDBNull(5) ? null : reader.GetString(5);
                var supporterType = reader.IsDBNull(6) ? null : reader.GetString(6);
                var authProvider = reader.IsDBNull(7) ? "local" : reader.GetString(7);
                var existingGoogleSub = reader.IsDBNull(8) ? null : reader.GetString(8);
                var googleProfileCompleted = !reader.IsDBNull(9) && reader.GetInt64(9) == 1;

                if (authProvider == "google" && string.IsNullOrWhiteSpace(existingGoogleSub) && !string.IsNullOrWhiteSpace(googleSub))
                {
                    using var bindSub = conn.CreateCommand();
                    bindSub.CommandText = "UPDATE users SET google_sub = @googleSub WHERE user_id = @userId";
                    DbConnectionFactory.Bind(bindSub, "@googleSub", googleSub);
                    DbConnectionFactory.Bind(bindSub, "@userId", userId);
                    bindSub.ExecuteNonQuery();
                }

                if (authProvider == "google" && (!googleProfileCompleted || string.IsNullOrWhiteSpace(supporterType)))
                {
                    if (string.IsNullOrWhiteSpace(selectedSupporterType))
                    {
                        return (userId, role, isActive, firstName, twoFactorEnabled, twoFactorSecret, true);
                    }

                    using var completeProfile = conn.CreateCommand();
                    completeProfile.CommandText = @"
                        UPDATE users
                        SET supporter_type = @supporterType,
                            relationship_type = @relationshipType,
                            google_profile_completed = 1
                        WHERE user_id = @userId";
                    DbConnectionFactory.Bind(completeProfile, "@supporterType", selectedSupporterType);
                    DbConnectionFactory.Bind(completeProfile, "@relationshipType", DefaultRelationshipTypeFor(selectedSupporterType));
                    DbConnectionFactory.Bind(completeProfile, "@userId", userId);
                    completeProfile.ExecuteNonQuery();
                }

                return (
                    userId,
                    role,
                    isActive,
                    firstName,
                    twoFactorEnabled,
                    twoFactorSecret,
                    false);
            }
        }

        var inferredFirstName = !string.IsNullOrWhiteSpace(givenName)
            ? givenName.Trim()
            : (!string.IsNullOrWhiteSpace(displayName) ? displayName.Trim().Split(' ')[0] : null);
        var lastName = !string.IsNullOrWhiteSpace(familyName) ? familyName.Trim() : null;

        if (string.IsNullOrWhiteSpace(selectedSupporterType))
        {
            using var insertPending = conn.CreateCommand();
            insertPending.CommandText = @"
                INSERT INTO users
                  (email, password_hash, role, first_name, last_name, supporter_type, relationship_type,
                   acquisition_channel, is_active, auth_provider, google_sub, google_profile_completed)
                VALUES
                  (@email, @passwordHash, 'donor', @firstName, @lastName, NULL, NULL,
                   'GoogleOAuth', 1, 'google', @googleSub, 0);"
                + _factory.LastInsertIdSql;
            DbConnectionFactory.Bind(insertPending, "@email", email);
            DbConnectionFactory.Bind(insertPending, "@passwordHash", BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N") + "#GoogleOnly"));
            DbConnectionFactory.Bind(insertPending, "@firstName", inferredFirstName);
            DbConnectionFactory.Bind(insertPending, "@lastName", lastName);
            DbConnectionFactory.Bind(insertPending, "@googleSub", googleSub);
            var pendingUserId = Convert.ToInt64(insertPending.ExecuteScalar() ?? 0L);
            return (pendingUserId, "donor", true, inferredFirstName, false, null, true);
        }

        var placeholderPasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N") + "#GoogleOnly");

        using (var insert = conn.CreateCommand())
        {
            insert.CommandText = @"
                INSERT INTO users
                  (email, password_hash, role, first_name, last_name, supporter_type, relationship_type,
                   acquisition_channel, is_active, auth_provider, google_sub, google_profile_completed)
                VALUES
                  (@email, @passwordHash, 'donor', @firstName, @lastName, @supporterType, @relationshipType,
                   'GoogleOAuth', 1, 'google', @googleSub, 1);"
                + _factory.LastInsertIdSql;
            DbConnectionFactory.Bind(insert, "@email", email);
            DbConnectionFactory.Bind(insert, "@passwordHash", placeholderPasswordHash);
            DbConnectionFactory.Bind(insert, "@firstName", inferredFirstName);
            DbConnectionFactory.Bind(insert, "@lastName", lastName);
            DbConnectionFactory.Bind(insert, "@supporterType", selectedSupporterType);
            DbConnectionFactory.Bind(insert, "@relationshipType", DefaultRelationshipTypeFor(selectedSupporterType));
            DbConnectionFactory.Bind(insert, "@googleSub", googleSub);
            var userId = Convert.ToInt64(insert.ExecuteScalar() ?? 0L);
            return (userId, "donor", true, inferredFirstName, false, null, false);
        }
    }

    private static bool TryNormalizeSupporterType(string? rawSupporterType, out string supporterType)
    {
        supporterType = string.Empty;
        if (string.IsNullOrWhiteSpace(rawSupporterType))
            return false;

        supporterType = rawSupporterType.Trim();
        return supporterType is
            "MonetaryDonor"
            or "InKindDonor"
            or "Volunteer"
            or "SkillsContributor"
            or "SocialMediaAdvocate"
            or "PartnerOrganization";
    }

    private static string DefaultRelationshipTypeFor(string supporterType)
    {
        return supporterType == "PartnerOrganization"
            ? "PartnerOrganization"
            : "Local";
    }

    // GET /api/auth/2fa/status
    [HttpGet("2fa/status")]
    [Authorize]
    public IActionResult TwoFactorStatus()
    {
        var email = User.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Invalid token claims." });

        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = _factory.OneRow("SELECT two_factor_enabled FROM users WHERE lower(email) = @email");
        DbConnectionFactory.Bind(cmd, "@email", email.Trim().ToLowerInvariant());
        var enabled = Convert.ToInt64(cmd.ExecuteScalar() ?? 0L) == 1L;
        return Ok(new { enabled });
    }

    // POST /api/auth/2fa/setup
    [HttpPost("2fa/setup")]
    [Authorize]
    public IActionResult SetupTwoFactor()
    {
        var email = User.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Invalid token claims." });

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var secret = GenerateBase32Secret();
        var issuer = "BrightHut";
        var otpauth = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(normalizedEmail)}?secret={secret}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits=6&period=30";

        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE users
            SET two_factor_secret = @secret,
                two_factor_enabled = 0
            WHERE lower(email) = @email";
        DbConnectionFactory.Bind(cmd, "@secret", secret);
        DbConnectionFactory.Bind(cmd, "@email", normalizedEmail);
        var rows = cmd.ExecuteNonQuery();
        if (rows == 0)
            return NotFound(new { error = "User not found." });

        return Ok(new { secret, otpauthUrl = otpauth });
    }

    // POST /api/auth/2fa/enable
    [HttpPost("2fa/enable")]
    [Authorize]
    public IActionResult EnableTwoFactor([FromBody] TwoFactorCodeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { error = "2FA code is required." });

        var email = User.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Invalid token claims." });

        using var conn = _factory.CreateConnection();
        conn.Open();
        using var get = conn.CreateCommand();
        get.CommandText = _factory.OneRow("SELECT two_factor_secret FROM users WHERE lower(email) = @email");
        DbConnectionFactory.Bind(get, "@email", email.Trim().ToLowerInvariant());
        var secret = get.ExecuteScalar() as string;

        if (string.IsNullOrWhiteSpace(secret))
            return BadRequest(new { error = "Run 2FA setup first." });

        if (!VerifyTotpCode(secret, req.Code))
            return BadRequest(new { error = "Invalid authentication code." });

        using var upd = conn.CreateCommand();
        upd.CommandText = "UPDATE users SET two_factor_enabled = 1 WHERE lower(email) = @email";
        DbConnectionFactory.Bind(upd, "@email", email.Trim().ToLowerInvariant());
        upd.ExecuteNonQuery();

        return Ok(new { enabled = true });
    }

    // POST /api/auth/2fa/disable
    [HttpPost("2fa/disable")]
    [Authorize]
    public IActionResult DisableTwoFactor([FromBody] TwoFactorCodeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { error = "2FA code is required." });

        var email = User.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Invalid token claims." });

        using var conn = _factory.CreateConnection();
        conn.Open();
        using var get = conn.CreateCommand();
        get.CommandText = _factory.OneRow("SELECT two_factor_secret, two_factor_enabled FROM users WHERE lower(email) = @email");
        DbConnectionFactory.Bind(get, "@email", email.Trim().ToLowerInvariant());
        using var reader = get.ExecuteReader();
        if (!reader.Read())
            return NotFound(new { error = "User not found." });

        var secret = reader.IsDBNull(0) ? null : reader.GetString(0);
        var enabled = !reader.IsDBNull(1) && reader.GetInt64(1) == 1;

        if (!enabled || string.IsNullOrWhiteSpace(secret))
            return Ok(new { enabled = false });

        if (!VerifyTotpCode(secret, req.Code))
            return BadRequest(new { error = "Invalid authentication code." });

        using var upd = conn.CreateCommand();
        upd.CommandText = "UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE lower(email) = @email";
        DbConnectionFactory.Bind(upd, "@email", email.Trim().ToLowerInvariant());
        upd.ExecuteNonQuery();

        return Ok(new { enabled = false });
    }

    private static string GenerateBase32Secret(int bytesLength = 20)
    {
        var bytes = RandomNumberGenerator.GetBytes(bytesLength);
        return Base32Encode(bytes);
    }

    private static bool VerifyTotpCode(string base32Secret, string rawCode)
    {
        var code = new string(rawCode.Where(char.IsDigit).ToArray());
        if (code.Length != 6)
            return false;

        var secretBytes = Base32Decode(base32Secret);
        var unixTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var step = unixTime / 30;

        for (long offset = -1; offset <= 1; offset++)
        {
            var generated = GenerateTotp(secretBytes, step + offset);
            if (generated == code)
                return true;
        }

        return false;
    }

    private static string GenerateTotp(byte[] secret, long timestep)
    {
        Span<byte> counter = stackalloc byte[8];
        for (var i = 7; i >= 0; i--)
        {
            counter[i] = (byte)(timestep & 0xFF);
            timestep >>= 8;
        }

        using var hmac = new HMACSHA1(secret);
        var hash = hmac.ComputeHash(counter.ToArray());
        var offset = hash[^1] & 0x0F;
        var binaryCode = ((hash[offset] & 0x7F) << 24)
                         | (hash[offset + 1] << 16)
                         | (hash[offset + 2] << 8)
                         | hash[offset + 3];
        var otp = binaryCode % 1_000_000;
        return otp.ToString("D6");
    }

    private static string Base32Encode(byte[] data)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var output = new StringBuilder((data.Length + 4) / 5 * 8);
        int bitBuffer = 0;
        int bitCount = 0;

        foreach (var b in data)
        {
            bitBuffer = (bitBuffer << 8) | b;
            bitCount += 8;
            while (bitCount >= 5)
            {
                var idx = (bitBuffer >> (bitCount - 5)) & 0x1F;
                output.Append(alphabet[idx]);
                bitCount -= 5;
            }
        }

        if (bitCount > 0)
        {
            var idx = (bitBuffer << (5 - bitCount)) & 0x1F;
            output.Append(alphabet[idx]);
        }

        return output.ToString();
    }

    private static byte[] Base32Decode(string input)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var normalized = new string(input
            .ToUpperInvariant()
            .Where(c => c is >= 'A' and <= 'Z' or >= '2' and <= '7')
            .ToArray());

        var output = new List<byte>(normalized.Length * 5 / 8);
        int bitBuffer = 0;
        int bitCount = 0;

        foreach (var c in normalized)
        {
            var val = alphabet.IndexOf(c);
            if (val < 0)
                continue;

            bitBuffer = (bitBuffer << 5) | val;
            bitCount += 5;
            while (bitCount >= 8)
            {
                output.Add((byte)((bitBuffer >> (bitCount - 8)) & 0xFF));
                bitCount -= 8;
            }
        }

        return output.ToArray();
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
        using var conn = _factory.CreateConnection();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT user_id, email, role, first_name, last_name, organization_name, phone, country, region, supporter_type, created_at, is_active FROM users ORDER BY created_at DESC";
        using var reader = cmd.ExecuteReader();
        var users = new List<object>();
        while (reader.Read())
        {
            users.Add(new
            {
                user_id        = Convert.ToInt64(reader.GetValue(0)),
                email          = reader.IsDBNull(1)  ? null : reader.GetString(1),
                role           = reader.IsDBNull(2)  ? null : reader.GetString(2),
                first_name     = reader.IsDBNull(3)  ? null : reader.GetString(3),
                last_name      = reader.IsDBNull(4)  ? null : reader.GetString(4),
                organization   = reader.IsDBNull(5)  ? null : reader.GetString(5),
                phone          = reader.IsDBNull(6)  ? null : reader.GetString(6),
                country        = reader.IsDBNull(7)  ? null : reader.GetString(7),
                region         = reader.IsDBNull(8)  ? null : reader.GetString(8),
                supporter_type = reader.IsDBNull(9)  ? null : reader.GetString(9),
                created_at     = reader.IsDBNull(10) ? null : reader.GetString(10),
                is_active      = Convert.ToInt64(reader.GetValue(11)) == 1,
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

    private string GenerateTwoFactorSetupToken(long userId, string email)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddMinutes(10);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(ClaimTypes.Role, "mfa_setup"),
            new Claim("purpose", "2fa_setup"),
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

    private static bool IsTwoFactorEnrollmentExempt(string normalizedEmail)
    {
        return normalizedEmail is "admin@brighthut.org" or "donor@brighthut.org";
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

public record TwoFactorCodeRequest(string Code);
public record LoginRequest(string Email, string Password, string? TwoFactorCode);
public record GoogleLoginRequest(string IdToken, string? TwoFactorCode, string? SupporterType);
