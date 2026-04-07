using Brighthut.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var jwtKey = Environment.GetEnvironmentVariable("JWT__KEY")
    ?? builder.Configuration["Jwt:Key"];
var jwtKeyLooksPlaceholder =
    string.IsNullOrWhiteSpace(jwtKey)
    || jwtKey.Contains("ChangeInProd", StringComparison.OrdinalIgnoreCase)
    || jwtKey.Contains("REPLACE_ME", StringComparison.OrdinalIgnoreCase);
var authEnabled = false;

if (jwtKeyLooksPlaceholder)
{
    if (builder.Environment.IsDevelopment())
    {
        // Dev-only key so local `dotnet run` works out of the box.
        jwtKey = "DEV_ONLY__REPLACE_WITH_STRONG_KEY_IN_PROD__0123456789";
        builder.Configuration["Jwt:Key"] = jwtKey;
        authEnabled = true;
    }
    else
    {
        throw new InvalidOperationException(
            "JWT key is not configured securely. Set environment variable JWT__KEY to a strong secret.");
    }
}
else
{
    builder.Configuration["Jwt:Key"] = jwtKey;
    authEnabled = true;
}

builder.Services.AddSingleton<SqliteDataService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
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
