
using System.Net;
using System.Net.Http.Json;
using AssetTracker.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace AssetTracker.Tests;

public class AssetTests
{
    private sealed class TestApiFactory : WebApplicationFactory<Program>
    {
        private readonly string _databasePath = Path.Combine(
            Path.GetTempPath(),
            $"assettracker-test-{Guid.NewGuid():N}.db");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<AppDbContext>>();

                services.AddDbContext<AppDbContext>(options =>
                    options.UseSqlite(
                        $"Data Source={_databasePath};Default Timeout=10"));
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);

            if (disposing)
            {
                foreach (var suffix in new[] { "", "-wal", "-shm" })
                {
                    var file = _databasePath + suffix;

                    if (File.Exists(file))
                        File.Delete(file);
                }
            }
        }
    }

    private static HttpClient CreateClient(
        TestApiFactory factory,
        string? userId)
    {
        var client = factory.CreateClient();

        if (!string.IsNullOrWhiteSpace(userId))
            client.DefaultRequestHeaders.Add("X-User-Id", userId);

        return client;
    }

    // R7 - Seed data
    [Fact]
    public async Task FirstRun_Seeds_Ten_Assets()
    {
        using var factory = new TestApiFactory();
        using var client = CreateClient(factory, "emp1");

        var assets = await client.GetFromJsonAsync<List<AssetDto>>(
            "/api/assets");

        Assert.NotNull(assets);
        Assert.Equal(10, assets.Count);
    }

    // R5 - Employee cannot create
    [Fact]
    public async Task Employee_Cannot_Create_Asset()
    {
        using var factory = new TestApiFactory();
        using var client = CreateClient(factory, "emp1");

        var response = await client.PostAsJsonAsync(
            "/api/assets",
            new
            {
                tag = "TEST-001",
                name = "Test Laptop",
                category = "Laptop"
            });

        Assert.Equal(
            HttpStatusCode.Forbidden,
            response.StatusCode);
    }

    // R5 - Missing identity
    [Fact]
    public async Task Missing_User_Returns_401()
    {
        using var factory = new TestApiFactory();
        using var client = CreateClient(factory, null);

        var response = await client.GetAsync("/api/assets");

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            response.StatusCode);
    }

    // R3 - Checkout and return
    [Fact]
    public async Task Employee_Can_Checkout_And_Return_Own_Asset()
    {
        using var factory = new TestApiFactory();
        using var client = CreateClient(factory, "emp1");

        var checkout = await client.PostAsync(
            "/api/assets/1/checkout", null);

        Assert.Equal(HttpStatusCode.OK, checkout.StatusCode);

        var checkedOut = await client.GetFromJsonAsync<AssetDto>(
            "/api/assets/1");

        Assert.NotNull(checkedOut);
        Assert.Equal("CheckedOut", checkedOut.Status);
        Assert.Equal("emp1", checkedOut.HeldByUserId);

        var returned = await client.PostAsync(
            "/api/assets/1/return", null);

        Assert.Equal(HttpStatusCode.OK, returned.StatusCode);

        var available = await client.GetFromJsonAsync<AssetDto>(
            "/api/assets/1");

        Assert.NotNull(available);
        Assert.Equal("Available", available.Status);
        Assert.Null(available.HeldByUserId);
    }

    // R5 - Ownership
    [Fact]
    public async Task Employee_Cannot_Return_Another_Users_Asset()
    {
        using var factory = new TestApiFactory();
        using var employee1 = CreateClient(factory, "emp1");
        using var employee2 = CreateClient(factory, "emp2");

        var checkout = await employee1.PostAsync(
            "/api/assets/1/checkout", null);

        Assert.Equal(HttpStatusCode.OK, checkout.StatusCode);

        var response = await employee2.PostAsync(
            "/api/assets/1/return", null);

        Assert.Equal(
            HttpStatusCode.Forbidden,
            response.StatusCode);
    }

    // R4 - Race condition
    [Fact]
    public async Task Two_Concurrent_Checkouts_Only_One_Succeeds()
    {
        using var factory = new TestApiFactory();
        using var employee1 = CreateClient(factory, "emp1");
        using var employee2 = CreateClient(factory, "emp2");

        // Initialize the server and seed the database.
        var setup = await employee1.GetAsync("/api/assets");
        setup.EnsureSuccessStatusCode();

        var gate = new TaskCompletionSource<bool>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        async Task<HttpStatusCode> AttemptCheckout(HttpClient client)
        {
            await gate.Task;

            using var response = await client.PostAsync(
                "/api/assets/2/checkout", null);

            return response.StatusCode;
        }

        var first = AttemptCheckout(employee1);
        var second = AttemptCheckout(employee2);

        // Release both requests together.
        gate.SetResult(true);

        var results = await Task.WhenAll(first, second);

        Assert.Equal(
            1, results.Count(s => s == HttpStatusCode.OK));

        Assert.Equal(
            1, results.Count(s => s == HttpStatusCode.Conflict));

        var asset = await employee1.GetFromJsonAsync<AssetDto>(
            "/api/assets/2");

        Assert.NotNull(asset);
        Assert.Equal("CheckedOut", asset.Status);
        Assert.Contains(asset.HeldByUserId, new[] { "emp1", "emp2" });
    }

    // R1 - Immutable asset tag
    [Fact]
    public async Task Admin_Edit_Does_Not_Change_Asset_Tag()
    {
        using var factory = new TestApiFactory();
        using var admin = CreateClient(factory, "admin");

        var response = await admin.PutAsJsonAsync(
            "/api/assets/1",
            new
            {
                name = "Updated Laptop",
                category = "IT",
                tag = "CHANGED-TAG"
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var asset = await admin.GetFromJsonAsync<AssetDto>(
            "/api/assets/1");

        Assert.NotNull(asset);
        Assert.Equal("AST-001", asset.Tag);
        Assert.Equal("Updated Laptop", asset.Name);
    }

    // R5 - 404 takes priority over 403
    [Fact]
    public async Task Unknown_Asset_Returns_404_Even_For_Employee()
    {
        using var factory = new TestApiFactory();
        using var employee = CreateClient(factory, "emp1");

        var response = await employee.PutAsJsonAsync(
            "/api/assets/99999",
            new
            {
                name = "Updated",
                category = "Laptop"
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // R3 - Checked out assets cannot be retired
    [Fact]
    public async Task CheckedOut_Asset_Cannot_Be_Retired()
    {
        using var factory = new TestApiFactory();
        using var employee = CreateClient(factory, "emp1");
        using var admin = CreateClient(factory, "admin");

        var checkout = await employee.PostAsync(
            "/api/assets/1/checkout", null);

        Assert.Equal(HttpStatusCode.OK, checkout.StatusCode);

        var retire = await admin.PostAsync(
            "/api/assets/1/retire", null);

        Assert.Equal(HttpStatusCode.Conflict, retire.StatusCode);
    }

    public record AssetDto(
        int Id,
        string Tag,
        string Name,
        string Category,
        string Status,
        string? HeldByUserId);
}
