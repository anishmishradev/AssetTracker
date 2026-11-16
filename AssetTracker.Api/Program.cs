
using AssetTracker.Api.Data;
using AssetTracker.Api.Models;
using AssetTracker.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Register Controllers
builder.Services.AddControllers();

// 2. Consistent validation error responses
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var messages = context.ModelState.Values
            .SelectMany(v => v.Errors)
            .Select(e => e.ErrorMessage)
            .ToArray();

        return new BadRequestObjectResult(new
        {
            code = "VALIDATION",
            message = string.Join("; ", messages)
        });
    };
});

// 3. Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 4. SQLite Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(
        "Data Source=assets.db;Default Timeout=10"
    ));

// 5. Register application services
// IMPORTANT: These must be BEFORE builder.Build()
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<UserService>();

// 6. Angular CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("Angular", policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// 7. Build application AFTER registering all services
var app = builder.Build();

// 8. Middleware
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("Angular");

app.MapControllers();

// 9. Automatically create database and seed 10 assets
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    db.Database.EnsureCreated();

    if (!db.Assets.Any())
    {
        for (int i = 1; i <= 10; i++)
        {
            db.Assets.Add(new Asset
            {
                Tag = $"AST-{i:000}",
                Name = $"Equipment {i}",
                Category = i % 3 == 0
                    ? "Phone"
                    : i % 2 == 0
                        ? "Monitor"
                        : "Laptop",
                Status = "Available"
            });
        }

        db.SaveChanges();
    }
}

// 10. Start API
app.Run();

// Required for integration tests
public partial class Program { }
