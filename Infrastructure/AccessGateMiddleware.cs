using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace NolwaziPortfolio.Infrastructure;

/// <summary>
/// Gates every page request behind a shared access key. Visitors without a valid
/// session cookie or a correct ?key= query value are shown the "Access Required"
/// butterfly page with a 403. Runs after UseStaticFiles, so CSS/JS/images needed
/// to render that page are never gated.
/// </summary>
public class AccessGateMiddleware
{
    private const string SessionCookieName = "session_token";
    private const string AccessRequiredPagePath = "wwwroot/access-required.html";
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    private readonly RequestDelegate _next;
    private readonly IMemoryCache _sessions;
    private readonly IWebHostEnvironment _env;
    private readonly byte[] _expectedKeyHash;
    private readonly PartitionedRateLimiter<string> _attemptLimiter;
    private string? _cachedPageHtml;

    public AccessGateMiddleware(RequestDelegate next, IConfiguration configuration, IMemoryCache sessions, IWebHostEnvironment env)
    {
        _next = next;
        _sessions = sessions;
        _env = env;

        var accessKey = configuration["AccessKey"]
            ?? throw new InvalidOperationException(
                "AccessKey is not configured. Set it via 'dotnet user-secrets set \"AccessKey\" \"...\"' locally, " +
                "or an AccessKey app setting/environment variable in production.");
        _expectedKeyHash = SHA256.HashData(Encoding.UTF8.GetBytes(accessKey));

        // 5 wrong-key attempts per IP per minute — enough for a genuine typo, not enough to brute force.
        _attemptLimiter = PartitionedRateLimiter.Create<string, string>(ip =>
            RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/healthz"))
        {
            await _next(context);
            return;
        }

        if (HasValidSession(context))
        {
            if (context.Request.Query.ContainsKey("key"))
            {
                // A returning visitor reused the ?key= link and already has a valid
                // session; strip the stale key from the URL instead of letting it
                // sit in the address bar for the whole visit.
                context.Response.Redirect(context.Request.Path, permanent: false);
                return;
            }

            await _next(context);
            return;
        }

        if (context.Request.Query.TryGetValue("key", out var submittedKey) && !string.IsNullOrEmpty(submittedKey))
        {
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            using var lease = _attemptLimiter.AttemptAcquire(ip);
            if (!lease.IsAcquired)
            {
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.Response.WriteAsync("Too many attempts. Try again in a minute.");
                return;
            }

            if (IsCorrectKey(submittedKey!))
            {
                IssueSession(context);

                // Redirect to strip the raw key out of the URL/history now that a session cookie exists.
                context.Response.Redirect(context.Request.Path, permanent: false);
                return;
            }
        }

        await WriteAccessRequiredPage(context);
    }

    private bool HasValidSession(HttpContext context)
    {
        var token = context.Request.Cookies[SessionCookieName];
        return !string.IsNullOrEmpty(token) && _sessions.TryGetValue(token, out _);
    }

    private bool IsCorrectKey(string submittedKey)
    {
        var submittedHash = SHA256.HashData(Encoding.UTF8.GetBytes(submittedKey));
        return CryptographicOperations.FixedTimeEquals(submittedHash, _expectedKeyHash);
    }

    private void IssueSession(HttpContext context)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        _sessions.Set(token, true, SessionLifetime);

        context.Response.Cookies.Append(SessionCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_env.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.Add(SessionLifetime),
            Path = "/"
        });
    }

    private async Task WriteAccessRequiredPage(HttpContext context)
    {
        _cachedPageHtml ??= await File.ReadAllTextAsync(Path.Combine(_env.ContentRootPath, AccessRequiredPagePath));

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.WriteAsync(_cachedPageHtml);
    }
}

public static class AccessGateMiddlewareExtensions
{
    public static IApplicationBuilder UseAccessGate(this IApplicationBuilder app)
        => app.UseMiddleware<AccessGateMiddleware>();
}
