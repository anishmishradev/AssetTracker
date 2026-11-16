
using System.Net;
using System.Net.Http.Json;
using AssetTracker.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NUnit.Framework;

namespace AssetTracker.Tests;

[TestFixture]
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
        {
            client.DefaultRequestHeaders.Add(
                "X-User-Id", userId);
        }

        return client;
    }

    // R7: Seed data
    [Test]
    public async Task FirstRun_Seeds_Ten_Assets()
    {
        using var factory = new TestApiFactory();
        using var client = CreateClient(factory, "emp1");

        var assets = await client.GetFromJsonAsync<List<AssetDto>>(
            "/api/assets");

        Assert.That(assets, Is.Not.Null);
        Assert.That(assets, Has.Count.EqualTo(10));
    }

    // R5: Employee cannot create
    [Test]
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

        Assert.That(
            response.StatusCode,
            Is.EqualTo(HttpStatusCode.Forbidden));
    }

    // R5: Missing identity
    [Test]
    public async Task Missing_User_Returns_401()
    {
        using var factory = new TestApiFactory();
        using var client = CreateClient(factory, null);

        var response = await client.GetAsync("/api/assets");

        Assert.That(
            response.StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    // R3: Checkout and return
    [Test]
    public async Task Employee_Can_Checkout_And_Return_Own_Asset()
    {
        using var factory = new TestApiFactory();
        using var client = CreateClient(factory, "emp1");

        var checkout = await client.PostAsync(
            "/api/assets/1/checkout", null);

        Assert.That(
            checkout.StatusCode,
            Is.EqualTo(HttpStatusCode.OK));

        var checkedOut = await client.GetFromJsonAsync<AssetDto>(
            "/api/assets/1");

        Assert.That(checkedOut, Is.Not.Null);
        Assert.That(checkedOut!.Status, Is.EqualTo("CheckedOut"));
        Assert.That(checkedOut.HeldByUserId, Is.EqualTo("emp1"));

        var returned = await client.PostAsync(
            "/api/assets/1/return", null);

        Assert.That(
            returned.StatusCode,
            Is.EqualTo(HttpStatusCode.OK));

        var available = await client.GetFromJsonAsync<AssetDto>(
            "/api/assets/1");

        Assert.That(available, Is.Not.Null);
        Assert.That(available!.Status, Is.EqualTo("Available"));
        Assert.That(available.HeldByUserId, Is.Null);
    }

    // R5: Ownership
    [Test]
    public async Task Employee_Cannot_Return_Another_Users_Asset()
    {
        using var factory = new TestApiFactory();
        using var employee1 = CreateClient(factory, "emp1");
        using var employee2 = CreateClient(factory, "emp2");

        var checkout = await employee1.PostAsync(
            "/api/assets/1/checkout", null);

        Assert.That(
            checkout.StatusCode,
            Is.EqualTo(HttpStatusCode.OK));

        var response = await employee2.PostAsync(
            "/api/assets/1/return", null);

        Assert.That(
            response.StatusCode,
            Is.EqualTo(HttpStatusCode.Forbidden));
    }

    // R4: Race condition
    [Test]
    public async Task Two_Concurrent_Checkouts_Only_One_Succeeds()
    {
        using var factory = new TestApiFactory();
        using var employee1 = CreateClient(factory, "emp1");
        using var employee2 = CreateClient(factory, "emp2");

        // Initialize server and seed the database.
        var setup = await employee1.GetAsync("/api/assets");
        setup.EnsureSuccessStatusCode();

        var gate = new TaskCompletionSource<bool>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        async Task<HttpStatusCode> AttemptCheckout(
            HttpClient client)
        {
            await gate.Task;

            using var response = await client.PostAsync(
                "/api/assets/2/checkout", null);

            return response.StatusCode;
        }

        var first = AttemptCheckout(employee1);
        var second = AttemptCheckout(employee2);

        // Release both requests at the same time.
        gate.SetResult(true);

        var results = await Task.WhenAll(first, second);

        Assert.Multiple(() =>
        {
            Assert.That(
                results.Count(s => s == HttpStatusCode.OK),
                Is.EqualTo(1));

            Assert.That(
                results.Count(s => s == HttpStatusCode.Conflict),
                Is.EqualTo(1));
        });

        var asset = await employee1.GetFromJsonAsync<AssetDto>(
            "/api/assets/2");

        Assert.That(asset, Is.Not.Null);
        Assert.That(asset!.Status, Is.EqualTo("CheckedOut"));
        Assert.That(
            asset.HeldByUserId,
            Is.AnyOf("emp1", "emp2"));
    }

    // R1: Immutable asset tag
    [Test]
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

        Assert.That(
            response.StatusCode,
            Is.EqualTo(HttpStatusCode.OK));

        var asset = await admin.GetFromJsonAsync<AssetDto>(
            "/api/assets/1");

        Assert.That(asset, Is.Not.Null);
        Assert.That(asset!.Tag, Is.EqualTo("AST-001"));
        Assert.That(asset.Name, Is.EqualTo("Updated Laptop"));
    }

    // R5: 404 takes priority over 403
    [Test]
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

        Assert.That(
            response.StatusCode,
            Is.EqualTo(HttpStatusCode.NotFound));
    }

    // R3: Checked-out assets cannot be retired
    [Test]
    public async Task CheckedOut_Asset_Cannot_Be_Retired()
    {
        using var factory = new TestApiFactory();
        using var employee = CreateClient(factory, "emp1");
        using var admin = CreateClient(factory, "admin");

        var checkout = await employee.PostAsync(
            "/api/assets/1/checkout", null);

        Assert.That(
            checkout.StatusCode,
            Is.EqualTo(HttpStatusCode.OK));

        var retire = await admin.PostAsync(
            "/api/assets/1/retire", null);

        Assert.That(
            retire.StatusCode,
            Is.EqualTo(HttpStatusCode.Conflict));
    }

    public record AssetDto(
        int Id,
        string Tag,
        string Name,
        string Category,
        string Status,
        string? HeldByUserId);
}
