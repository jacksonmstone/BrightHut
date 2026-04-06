using Brighthut.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<SqliteDataService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

app.UseHttpsRedirection();
if (allowedOrigins.Length > 0)
{
    app.UseCors();
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
