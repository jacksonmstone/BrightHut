using Microsoft.AspNetCore.Mvc;

namespace Brighthut.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public IActionResult Get()
    {
        return Ok(new HealthResponse("healthy", DateTime.UtcNow));
    }

    public sealed record HealthResponse(string Status, DateTime UtcTimestamp);
}
