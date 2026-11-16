
namespace AssetTracker.Api.Models;

public class Asset
{
    public int Id { get; set; }
    public string Tag { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Status { get; set; } = "Available";
    public string? HeldByUserId { get; set; }
}

public record AssetInput(
    string Tag,
    string Name,
    string Category);

public record EditInput(
    string Name,
    string Category);
