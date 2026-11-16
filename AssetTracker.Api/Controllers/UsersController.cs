
using Microsoft.AspNetCore.Mvc;

namespace AssetTracker.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private static readonly object[] Users =
    {
        new { Id = "emp1", Name = "Employee One", Role = "Employee" },
        new { Id = "emp2", Name = "Employee Two", Role = "Employee" },
        new { Id = "admin", Name = "Administrator", Role = "Admin" }
    };

    [HttpGet]
    public IActionResult GetUsers()
    {
        return Ok(Users);
    }
}
