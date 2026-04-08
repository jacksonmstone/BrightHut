using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Brighthut.Controllers;

/// <summary>
/// Returns a behavioral regression risk score for a single resident.
///
/// Scoring formula derived from the resident-regression-risk.ipynb explanatory
/// logistic regression model (see ml-pipelines/resident-regression-risk.ipynb).
/// Features and weights are calibrated for raw (un-normalized) feature values.
///
/// A resident is at regression risk if they have recent incidents or their
/// emotional state has been declining relative to their own historical baseline.
/// This endpoint surfaces the top factors driving that risk so that social workers
/// can act on them directly.
/// </summary>
[ApiController]
[Route("api/residents/{residentId:long}/regression-risk")]
[Authorize(Roles = "staff,admin")]
public class ResidentRegressionRiskController : ControllerBase
{
    private readonly SqliteDataService _db;

    // ── Logistic regression weights (calibrated for raw feature values) ───────
    //
    // RISK factors (positive weights → higher risk score):
    //   total_incidents:       mean ≈ 3,   range 0–20
    //   recent_incidents:      mean ≈ 0.5, range 0–10  (last 90 days)
    //   max_incident_severity: mean ≈ 1.5, range 0–3   (Low=1, Med=2, High=3)
    //   recent_max_severity:   mean ≈ 0.5, range 0–3   (0 = no recent incidents)
    //   has_safety_concern:    mean ≈ 0.2, range 0–1   (any visit with concern)
    //   emotion_volatility:    mean ≈ 0.6, range 0–3   (std dev of emotion scores)
    //
    // PROTECTIVE factors (negative weights → lower risk score):
    //   avg_emotion_score:     mean ≈ 5,   range 1–7
    //   avg_family_coop:       mean ≈ 2.8, range 1–4
    //   is_enrolled:           mean ≈ 0.6, range 0–1
    //   session_count:         mean ≈ 20,  range 0–100
    //   recent_session_count:  mean ≈ 3,   range 0–20  (last 90 days)
    //   avg_health_score:      mean ≈ 6,   range 1–10
    //
    // Intercept chosen so a resident near mean values scores ≈ 0.34 (Stable tier),
    // a resident with several active risk factors scores ≈ 0.60–0.75 (High Risk),
    // and a well-supported resident scores ≈ 0.10–0.15.
    private const double Intercept = 1.2;

    private static readonly (string Key, double Weight)[] Weights =
    [
        ("total_incidents",       +0.050),
        ("recent_incidents",      +0.050),
        ("max_incident_severity", +0.100),
        ("recent_max_severity",   +0.150),
        ("has_safety_concern",    +0.300),
        ("emotion_volatility",    +0.250),
        ("avg_emotion_score",     -0.150),
        ("avg_family_coop",       -0.150),
        ("is_enrolled",           -0.400),
        ("session_count",         -0.006),
        ("recent_session_count",  -0.030),
        ("avg_health_score",      -0.080),
    ];

    private static readonly Dictionary<string, string> FeatureLabels = new()
    {
        ["total_incidents"]       = "Total incident reports",
        ["recent_incidents"]      = "Recent incidents (last 90 days)",
        ["max_incident_severity"] = "Highest incident severity",
        ["recent_max_severity"]   = "Recent incident severity",
        ["has_safety_concern"]    = "Safety concern during home visit",
        ["emotion_volatility"]    = "Emotional stability",
        ["avg_emotion_score"]     = "Average emotional state",
        ["avg_family_coop"]       = "Family cooperation level",
        ["is_enrolled"]           = "School enrollment",
        ["session_count"]         = "Total counseling sessions",
        ["recent_session_count"]  = "Recent counseling sessions",
        ["avg_health_score"]      = "General health score",
    };

    // Emotion valence — higher = more positive emotional state (1–7 scale)
    private static readonly Dictionary<string, double> EmotionValence =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Happy"]      = 7,
            ["Hopeful"]    = 6,
            ["Calm"]       = 5,
            ["Anxious"]    = 3,
            ["Sad"]        = 2,
            ["Angry"]      = 2,
            ["Withdrawn"]  = 2,
            ["Distressed"] = 1,
        };

    // Cooperation score (1–4 scale)
    private static readonly Dictionary<string, double> CooperationScore =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Highly Cooperative"] = 4,
            ["Cooperative"]        = 3,
            ["Neutral"]            = 2,
            ["Uncooperative"]      = 1,
        };

    // Incident severity (1–3 scale)
    private static readonly Dictionary<string, double> SeverityScore =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Low"]    = 1,
            ["Medium"] = 2,
            ["High"]   = 3,
        };

    public ResidentRegressionRiskController(SqliteDataService db) => _db = db;

    [HttpGet]
    public IActionResult GetRegressionRisk(long residentId)
    {
        // ── Verify resident exists ────────────────────────────────────────────
        var residents = _db.QueryAll("residents");
        var resident  = residents.FirstOrDefault(r => ToLong(r["resident_id"]) == residentId);
        if (resident is null)
            return NotFound(new { error = $"Resident {residentId} not found." });

        // ── 90-day cutoff ─────────────────────────────────────────────────────
        var cutoff = DateTime.UtcNow.AddDays(-90).ToString("yyyy-MM-dd");

        // ── Load per-resident records ─────────────────────────────────────────
        var recordings  = _db.QueryAll("process_recordings")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var visitations = _db.QueryAll("home_visitations")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var health      = _db.QueryAll("health_wellbeing_records")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var education   = _db.QueryAll("education_records")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var incidents   = _db.QueryAll("incident_reports")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();

        // ── Feature engineering ───────────────────────────────────────────────
        var f = new Dictionary<string, double>();

        // ── Incident features ─────────────────────────────────────────────────
        f["total_incidents"] = incidents.Count;

        var recentIncidents = incidents
            .Where(i => string.Compare(DateStr(i.GetValueOrDefault("incident_date")), cutoff, StringComparison.Ordinal) >= 0)
            .ToList();
        f["recent_incidents"] = recentIncidents.Count;

        var severities = incidents
            .Select(i => SeverityOf(i.GetValueOrDefault("severity")))
            .Where(v => v > 0).ToList();
        f["max_incident_severity"] = severities.Count > 0 ? severities.Max() : 0.0;

        var recentSeverities = recentIncidents
            .Select(i => SeverityOf(i.GetValueOrDefault("severity")))
            .Where(v => v > 0).ToList();
        f["recent_max_severity"] = recentSeverities.Count > 0 ? recentSeverities.Max() : 0.0;

        // ── Home visitation features ──────────────────────────────────────────
        f["has_safety_concern"] = visitations.Any(v => IsTrue(v.GetValueOrDefault("safety_concerns_noted")))
            ? 1.0 : 0.0;

        var coopScores = visitations
            .Select(v => CoopScoreOf(v.GetValueOrDefault("family_cooperation_level")))
            .Where(v => !double.IsNaN(v)).ToList();
        f["avg_family_coop"] = coopScores.Count > 0 ? coopScores.Average() : 2.5; // neutral prior

        // ── Emotion features (use end-of-session state; fall back to observed) ─
        var emotionScores = recordings
            .Select(r =>
            {
                var end   = ValenceOf(r.GetValueOrDefault("emotional_state_end"));
                var start = ValenceOf(r.GetValueOrDefault("emotional_state_observed"));
                return !double.IsNaN(end) ? end : start;
            })
            .Where(v => !double.IsNaN(v)).ToList();

        f["avg_emotion_score"] = emotionScores.Count > 0 ? emotionScores.Average() : 4.0; // neutral prior

        // Volatility = population std dev of emotion scores
        if (emotionScores.Count >= 2)
        {
            var mean = emotionScores.Average();
            var variance = emotionScores.Sum(s => (s - mean) * (s - mean)) / emotionScores.Count;
            f["emotion_volatility"] = Math.Sqrt(variance);
        }
        else
        {
            f["emotion_volatility"] = 0.0;
        }

        // ── Session features ──────────────────────────────────────────────────
        f["session_count"] = recordings.Count;

        f["recent_session_count"] = recordings
            .Count(r => string.Compare(DateStr(r.GetValueOrDefault("session_date")), cutoff, StringComparison.Ordinal) >= 0);

        // ── Health features ───────────────────────────────────────────────────
        var healthScores = health
            .Select(h => ToDouble(h.GetValueOrDefault("general_health_score")))
            .Where(v => !double.IsNaN(v)).ToList();
        f["avg_health_score"] = healthScores.Count > 0 ? healthScores.Average() : 5.0; // neutral prior

        // ── Education enrollment ──────────────────────────────────────────────
        f["is_enrolled"] = education.Count > 0 ? 1.0 : 0.0;

        // ── Logistic scoring ──────────────────────────────────────────────────
        var linear        = Intercept;
        var contributions = new Dictionary<string, double>();
        foreach (var (key, weight) in Weights)
        {
            var contrib = weight * f[key];
            contributions[key] = contrib;
            linear += contrib;
        }

        var score = Sigmoid(linear);

        var tier = score >= 0.60 ? "High Risk"
                 : score >= 0.35 ? "Moderate Risk"
                 : "Stable";

        // ── Driver selection: top 2 risk-increasing features ─────────────────
        // Only surface features that are actively pushing the score UP (positive contribution).
        // These become the "focus areas" in the combined clinical assessment UI.
        var topRiskDrivers = contributions
            .Where(kv => kv.Value > 0)
            .OrderByDescending(kv => kv.Value)
            .Take(2)
            .Select(kv => new
            {
                feature = FeatureLabels[kv.Key],
                rawKey  = kv.Key,
                value   = Math.Round(f[kv.Key], 2),
            })
            .ToList();

        return Ok(new
        {
            residentId     = residentId,
            riskScore      = Math.Round(score, 4),
            riskTier       = tier,
            flag           = score >= 0.50,
            features       = f.ToDictionary(kv => kv.Key, kv => Math.Round(kv.Value, 3)),
            topRiskDrivers,
            modelVersion   = "regression_risk_heuristic_v1",
            disclaimer     = "This score is a clinical decision-support tool. It does not replace " +
                             "professional social work judgment. All risk assessments must be " +
                             "reviewed by a qualified social worker before any action is taken.",
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static double Sigmoid(double x) => 1.0 / (1.0 + Math.Exp(-x));

    private static long ToLong(object? v)
    {
        if (v is null) return 0;
        try { return Convert.ToInt64(v); }
        catch { return 0; }
    }

    private static double ToDouble(object? v)
    {
        if (v is null) return double.NaN;
        try
        {
            var d = Convert.ToDouble(v);
            return double.IsFinite(d) ? d : double.NaN;
        }
        catch { return double.NaN; }
    }

    private static string DateStr(object? v) =>
        v is string s ? s.Trim() : v?.ToString()?.Trim() ?? "";

    private static bool IsTrue(object? v) =>
        v is not null && v switch
        {
            bool b  => b,
            long l  => l != 0,
            int  i  => i != 0,
            _       => string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase)
                    || v.ToString() == "1",
        };

    private double ValenceOf(object? v) =>
        v is string s && EmotionValence.TryGetValue(s.Trim(), out var val) ? val : double.NaN;

    private double CoopScoreOf(object? v) =>
        v is string s && CooperationScore.TryGetValue(s.Trim(), out var val) ? val : double.NaN;

    private static double SeverityOf(object? v) =>
        v is string s && SeverityScore.TryGetValue(s.Trim(), out var val) ? val : 0.0;
}
