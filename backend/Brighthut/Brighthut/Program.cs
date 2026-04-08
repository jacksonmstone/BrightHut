using Brighthut.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Load JWT key: env var takes priority over appsettings.json.
// In Azure App Service set JWT__KEY under Configuration > Application settings.
// In local dev, set JWT__KEY in your environment or launchSettings.json.
var jwtKey = Environment.GetEnvironmentVariable("JWT__KEY")
    ?? builder.Configuration["Jwt:Key"];

var jwtKeyIsPlaceholder =
    string.IsNullOrWhiteSpace(jwtKey)
    || jwtKey.StartsWith("REPLACE_ME", StringComparison.OrdinalIgnoreCase)
    || jwtKey.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase);

if (jwtKeyIsPlaceholder)
{
    if (!builder.Environment.IsDevelopment())
    {
        // Fail fast in production — never run with a placeholder key.
        throw new InvalidOperationException(
            "JWT__KEY is not configured. Set it in Azure App Service > Configuration > Application settings.");
    }

    // Development only: use a local-only dev key so the API starts without extra setup.
    // This key is NOT secure and must never be used in production.
    jwtKey = "DEV_ONLY__NOT_FOR_PRODUCTION__brighthut_local_dev_key_0000";
    Console.WriteLine("BrightHut API [DEV]: Using embedded dev JWT key. Set JWT__KEY env var for any real deployment.");
}

builder.Configuration["Jwt:Key"] = jwtKey;
var authEnabled = true;

builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddSingleton<SqliteDataService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHsts(options =>
{
    // 1 year HSTS policy for production traffic.
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
    options.Preload = true;
});

if (authEnabled)
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = builder.Configuration["Jwt:Issuer"],
                ValidAudience = builder.Configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!)),
            };
        });
    builder.Services.AddAuthorization();
}

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? Array.Empty<string>();
if (allowedOrigins.Length > 0)
{
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
    });
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
if (allowedOrigins.Length > 0)
{
    app.UseCors();
}

app.Use(async (context, next) =>
{
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none';";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    await next();
});

if (authEnabled)
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.MapControllers();

app.MapGet(
    "/",
    () =>
        Results.Json(
            new
            {
                message = "BrightHut API",
                swagger = "/swagger",
                health = "/api/health",
                tables = "/api/tables/{tableName}",
                examples = new[]
                {
                    "/api/tables/safehouses",
                    "/api/tables/residents",
                    "/api/tables/donations",
                },
            }));

app.Run();
