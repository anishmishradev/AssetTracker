
using Microsoft.AspNetCore.Http;

namespace AssetTracker.Api.Services;

public class UserService
{
    private static readonly Dictionary<string, string> Users = new()
    {
        ["emp1"] = "Employee",
        ["emp2"] = "Employee",
        ["admin"] = "Admin"
    };

    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? CurrentUserId =>
        _httpContextAccessor.HttpContext?
            .Request.Headers["X-User-Id"].FirstOrDefault();

    public bool IsAuthenticated =>
        CurrentUserId != null &&
        Users.ContainsKey(CurrentUserId);

    public bool IsAdmin =>
        IsAuthenticated &&
        Users[CurrentUserId!] == "Admin";

    public bool CanReturn(string? heldByUserId) =>
        IsAdmin || heldByUserId == CurrentUserId;
}
