
using AssetTracker.Api.Data;
using AssetTracker.Api.Models;
using AssetTracker.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AssetTracker.Api.Controllers;

[ApiController]
[Route("api/assets")]
public class AssetsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserService _userService;

    public AssetsController(
        AppDbContext db,
        UserService userService)
    {
        _db = db;
        _userService = userService;
    }

    // -------------------------------
    // Authentication and permissions
    // -------------------------------

    private string? CurrentUser => _userService.CurrentUserId;

    private bool IsAdmin => _userService.IsAdmin;

    private ObjectResult Error(
        int status,
        string code,
        string message)
    {
        return StatusCode(status, new { code, message });
    }

    private IActionResult? CheckAccess(bool adminOnly = false)
    {
        if (!_userService.IsAuthenticated)
            return Error(
                401,
                "UNAUTHORIZED",
                "Please select a valid user.");

        if (adminOnly && !IsAdmin)
            return Error(
                403,
                "FORBIDDEN",
                "Only administrators can perform this action.");

        return null;
    }

    // -------------------------------
    // R2 - List, search and filter
    // -------------------------------

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? search)
    {
        var denied = CheckAccess();
        if (denied != null)
            return denied;

        var query = _db.Assets.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (status != "Available" &&
                status != "CheckedOut" &&
                status != "Retired")
                return Error(400, "VALIDATION",
                    "Invalid asset status.");

            query = query.Where(a => a.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            query = query.Where(a =>
                a.Name.Contains(term) ||
                a.Tag.Contains(term));
        }

        return Ok(await query
            .OrderBy(a => a.Id)
            .ToListAsync());
    }


// Bonus - Paging and category filter
[HttpGet("paged")]
public async Task<IActionResult> GetPaged(
    [FromQuery] string? status,
    [FromQuery] string? search,
    [FromQuery] string? category,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 5)
{
    var denied = CheckAccess();
    if (denied != null)
        return denied;

    if (page < 1 || pageSize < 1 || pageSize > 100)
        return Error(400, "VALIDATION",
            "Invalid page or page size.");

    var query = _db.Assets.AsNoTracking().AsQueryable();

    if (!string.IsNullOrWhiteSpace(status))
    {
        if (status != "Available" &&
            status != "CheckedOut" &&
            status != "Retired")
            return Error(400, "VALIDATION",
                "Invalid asset status.");

        query = query.Where(a => a.Status == status);
    }

    if (!string.IsNullOrWhiteSpace(search))
    {
        var term = search.Trim();

        query = query.Where(a =>
            a.Name.Contains(term) ||
            a.Tag.Contains(term));
    }

    if (!string.IsNullOrWhiteSpace(category))
    {
        var selectedCategory = category.Trim();
        query = query.Where(a => a.Category == selectedCategory);
    }

    var totalCount = await query.CountAsync();

    var items = await query
        .OrderBy(a => a.Id)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();

    return Ok(new
    {
        items,
        totalCount,
        page,
        pageSize,
        totalPages = (int)Math.Ceiling(
            totalCount / (double)pageSize)
    });
}
    // -------------------------------
    // Get asset by ID
    // -------------------------------


    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var asset = await _db.Assets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asset == null)
            return Error(404, "NOT_FOUND",
                "Asset not found.");

        var denied = CheckAccess();
        if (denied != null)
            return denied;

        return Ok(asset);
    }

    // -------------------------------
    // R1 - Create asset (Admin only)
    // -------------------------------

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] AssetInput input)
    {
        var denied = CheckAccess(adminOnly: true);
        if (denied != null)
            return denied;

        if (input == null ||
            string.IsNullOrWhiteSpace(input.Tag) ||
            string.IsNullOrWhiteSpace(input.Name) ||
            string.IsNullOrWhiteSpace(input.Category))
        {
            return Error(400, "VALIDATION",
                "Tag, name and category are required.");
        }

        var tag = input.Tag.Trim();

        if (await _db.Assets.AnyAsync(a => a.Tag == tag))
        {
            return Error(400, "DUPLICATE_TAG",
                "Asset tag already exists.");
        }

        var asset = new Asset
        {
            Tag = tag,
            Name = input.Name.Trim(),
            Category = input.Category.Trim(),
            Status = "Available",
            HeldByUserId = null
        };

        _db.Assets.Add(asset);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Error(400, "DUPLICATE_TAG",
                "Asset tag already exists.");
        }

        return CreatedAtAction(
            nameof(GetById),
            new { id = asset.Id },
            asset);
    }

    // -------------------------------
    // R1 - Edit asset (Admin only)
    // Tag cannot be modified
    // -------------------------------

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] EditInput input)
    {
        var asset = await _db.Assets.FindAsync(id);

        if (asset == null)
            return Error(404, "NOT_FOUND",
                "Asset not found.");

        var denied = CheckAccess(adminOnly: true);
        if (denied != null)
            return denied;

        if (asset.Status == "Retired")
            return Error(409, "CONFLICT",
                "Retired assets cannot be edited.");

        if (input == null ||
            string.IsNullOrWhiteSpace(input.Name) ||
            string.IsNullOrWhiteSpace(input.Category))
        {
            return Error(400, "VALIDATION",
                "Name and category are required.");
        }

        asset.Name = input.Name.Trim();
        asset.Category = input.Category.Trim();

        await _db.SaveChangesAsync();

        return Ok(asset);
    }

    // -------------------------------
    // R3/R4 - Checkout asset
    // Employee/Admin can checkout
    // Atomic update prevents double checkout
    // -------------------------------

    [HttpPost("{id:int}/checkout")]
    public async Task<IActionResult> Checkout(int id)
    {
        var asset = await _db.Assets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asset == null)
            return Error(404, "NOT_FOUND",
                "Asset not found.");

        var denied = CheckAccess();
        if (denied != null)
            return denied;

        var userId = CurrentUser!;

        var updated = await _db.Assets
            .Where(a =>
                a.Id == id &&
                a.Status == "Available")
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(a => a.Status, "CheckedOut")
                .SetProperty(a => a.HeldByUserId, userId));

        if (updated == 0)
        {
            return Error(409, "CONFLICT",
                "Asset is already checked out or unavailable.");
        }

        return Ok(new
        {
            message = "Asset checked out successfully.",
            assetId = id,
            heldByUserId = userId
        });
    }

    // -------------------------------
    // R3/R5 - Return asset
    // Employee: own asset only
    // Admin: any asset
    // -------------------------------

    [HttpPost("{id:int}/return")]
    public async Task<IActionResult> Return(int id)
    {
        var asset = await _db.Assets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asset == null)
            return Error(404, "NOT_FOUND",
                "Asset not found.");

        var denied = CheckAccess();
        if (denied != null)
            return denied;

        var userId = CurrentUser!;

        // Ownership check before status check.
        if (!IsAdmin &&
            asset.HeldByUserId != null &&
            asset.HeldByUserId != userId)
        {
            return Error(403, "FORBIDDEN",
                "You can only return assets you hold.");
        }

        if (asset.Status != "CheckedOut")
        {
            return Error(409, "CONFLICT",
                "Asset is not currently checked out.");
        }

        var query = _db.Assets.Where(a =>
            a.Id == id &&
            a.Status == "CheckedOut");

        if (!IsAdmin)
        {
            query = query.Where(a =>
                a.HeldByUserId == userId);
        }

        var updated = await query.ExecuteUpdateAsync(setters => setters
            .SetProperty(a => a.Status, "Available")
            .SetProperty(a => a.HeldByUserId, (string?)null));

        if (updated == 0)
        {
            // Re-read to distinguish a changed owner from
            // an invalid status transition.
            var latest = await _db.Assets.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == id);

            if (latest == null)
                return Error(404, "NOT_FOUND",
                    "Asset not found.");

            if (!IsAdmin &&
                latest.HeldByUserId != null &&
                latest.HeldByUserId != userId)
            {
                return Error(403, "FORBIDDEN",
                    "You can only return assets you hold.");
            }

            return Error(409, "CONFLICT",
                "Asset status has changed. Please refresh.");
        }

        return Ok(new
        {
            message = "Asset returned successfully.",
            assetId = id
        });
    }

    // -------------------------------
    // R3/R5 - Retire asset
    // Admin only
    // Available -> Retired
    // Retired is final
    // -------------------------------

    [HttpPost("{id:int}/retire")]
    public async Task<IActionResult> Retire(int id)
    {
        var asset = await _db.Assets.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asset == null)
            return Error(404, "NOT_FOUND",
                "Asset not found.");

        var denied = CheckAccess(adminOnly: true);
        if (denied != null)
            return denied;

        var updated = await _db.Assets
            .Where(a =>
                a.Id == id &&
                a.Status == "Available")
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(a => a.Status, "Retired"));

        if (updated == 0)
        {
            return Error(409, "CONFLICT",
                "Only available assets can be retired. Return checked-out assets first.");
        }

        return Ok(new
        {
            message = "Asset retired successfully.",
            assetId = id
        });
    }
}
