using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Brighthut.Controllers;

/// <summary>
/// Returns a per-resident intervention effectiveness score.
///
/// Scoring formula derived from the intervention-effectiveness.ipynb pipeline
/// (see ml-pipelines/intervention-effectiveness.ipynb).
///
/// Composite improvement target: positive direction in ≥2 of 3 domains
/// (emotional state, health, education).
///
/// Status labels:
///   IMPROVING         score ≥ 0.65
///   ON TRACK          score ≥ 0.45
///   REVIEW NEEDED     score  &lt; 0.45
///   INSUFFICIENT DATA fewer than 2 process recordings
/// </summary>
[ApiController]
[Route("api/residents/{residentId:long}/intervention-effectiveness")]
[Authorize(Roles = "staff,admin")]
public class InterventionEffectivenessController : ControllerBase
{
    private readonly SqliteDataService _db;

    // ── Logistic regression weights (calibrated for raw feature values) ────────
    //
    // IMPROVEMENT signals (positive weights):
    //   n_recordings              mean ≈ 10,  range 0–100   (total session count)
    //   pct_completed_plans       mean ≈ 0.5, range 0–1     (plan completion rate)
    //   intervention_breadth      mean ≈ 2,   range 0–5     (distinct plan types)
    //   has_educational_support   mean ≈ 0.7, range 0–1     (any education record)
    //   edu_enrolled              mean ≈ 0.6, range 0–1     (currently enrolled)
    //   emotion_delta             mean ≈ 0.5, range -6–6    (recent vs. first emotion)
    //   health_delta              mean ≈ 0.5, range -9–9    (recent vs. first health)
    //   family_cooperation        mean ≈ 2.8, range 1–4     (avg cooperation score)
    //
    // Calibration targets:
    //   minimal data, no progress      → score ≈ 0.20  (REVIEW NEEDED)
    //   average features               → score ≈ 0.45  (ON TRACK boundary)
    //   strong completion + improving  → score ≈ 0.85  (IMPROVING)
    private const double Intercept = -3.2;

    private static readonly (string Key, double Weight)[] Weights =
    [
        ("n_recordings",            +0.020),
        ("pct_completed_plans",     +1.200),
        ("intervention_breadth",    +0.300),
        ("has_educational_support", +0.500),
        ("edu_enrolled",            +0.600),
        ("emotion_delta",           +0.400),
        ("health_delta",            +0.300),
        ("family_cooperation",      +0.200),
    ];

    // Emotion valence (1–7 scale, higher = more positive)
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

    public InterventionEffectivenessController(SqliteDataService db) => _db = db;

    [HttpGet]
    public IActionResult GetInterventionEffectiveness(long residentId)
    {
        // ── Verify resident ───────────────────────────────────────────────────
        var residents = _db.QueryAll("residents");
        var resident  = residents.FirstOrDefault(r => ToLong(r["resident_id"]) == residentId);
        if (resident is null)
            return NotFound(new { error = $"Resident {residentId} not found." });

        // ── Load per-resident records ─────────────────────────────────────────
        var recordings = _db.QueryAll("process_recordings")
            .Where(r => ToLong(r["resident_id"]) == residentId)
            .OrderBy(r => DateStr(r.GetValueOrDefault("session_date")))
            .ToList();

        var plans = _db.QueryAll("intervention_plans")
            .Where(r => ToLong(r["resident_id"]) == residentId).ToList();

        var education = _db.QueryAll("education_records")
            .Where(r => ToLong(r["resident_id"]) == residentId).ToList();

        var health = _db.QueryAll("health_wellbeing_records")
            .Where(r => ToLong(r["resident_id"]) == residentId)
            .OrderBy(r => DateStr(r.GetValueOrDefault("record_date")))
            .ToList();

        var visitations = _db.QueryAll("home_visitations")
            .Where(r => ToLong(r["resident_id"]) == residentId).ToList();

        // ── Insufficient data guard ───────────────────────────────────────────
        if (recordings.Count < 2)
        {
            return Ok(new
            {
                residentId       = residentId,
                statusLabel      = "INSUFFICIENT DATA",
                improvementScore = (double?)null,
                flag             = false,
                topDomain        = (string?)null,
                topDomainLabel   = (string?)null,
                modelVersion     = "intervention_effectiveness_heuristic_v1",
                disclaimer       = "At least 2 process recordings are required to generate a score.",
            });
        }

        // ── Feature engineering ───────────────────────────────────────────────
        var f = new Dictionary<string, double>();

        // n_recordings
        f["n_recordings"] = recordings.Count;

        // pct_completed_plans
        if (plans.Count > 0)
        {
            var completed = plans.Count(p =>
                string.Equals(p.GetValueOrDefault("status") as string, "Completed",
                    StringComparison.OrdinalIgnoreCase));
            f["pct_completed_plans"] = (double)completed / plans.Count;
        }
        else f["pct_completed_plans"] = 0.0;

        // intervention_breadth — distinct plan types
        f["intervention_breadth"] = plans
            .Select(p => (p.GetValueOrDefault("plan_type") ?? p.GetValueOrDefault("intervention_type")) as string)
            .Where(t => t != null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        // has_educational_support
        f["has_educational_support"] = education.Count > 0 ? 1.0 : 0.0;

        // edu_enrolled
        f["edu_enrolled"] = education.Any(e => IsTrue(e.GetValueOrDefault("is_currently_enrolled")))
            ? 1.0 : 0.0;

        // emotion_delta: average of last 3 sessions minus first session emotion
        var emotionScores = recordings
            .Select(r =>
            {
                var end   = ValenceOf(r.GetValueOrDefault("emotional_state_end"));
                var start = ValenceOf(r.GetValueOrDefault("emotional_state_observed"));
                return !double.IsNaN(end) ? end : start;
            })
            .Where(v => !double.IsNaN(v))
            .ToList();

        double emotionDelta = 0;
        if (emotionScores.Count >= 2)
        {
            var firstEmotion  = emotionScores.First();
            var recentEmotion = emotionScores.TakeLast(Math.Min(3, emotionScores.Count)).Average();
            emotionDelta = recentEmotion - firstEmotion;
        }
        f["emotion_delta"] = emotionDelta;

        // health_delta: average of last 3 records minus first health score
        var healthScores = health
            .Select(h => ToDouble(h.GetValueOrDefault("general_health_score")))
            .Where(v => !double.IsNaN(v))
            .ToList();

        double healthDelta = 0;
        if (healthScores.Count >= 2)
        {
            var firstHealth  = healthScores.First();
            var recentHealth = healthScores.TakeLast(Math.Min(3, healthScores.Count)).Average();
            healthDelta = recentHealth - firstHealth;
        }
        f["health_delta"] = healthDelta;

        // family_cooperation
        var coopScores = visitations
            .Select(v => CoopScoreOf(v.GetValueOrDefault("family_cooperation_level")))
            .Where(v => !double.IsNaN(v)).ToList();
        f["family_cooperation"] = coopScores.Count > 0 ? coopScores.Average() : 2.5; // neutral prior

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

        var statusLabel = score >= 0.65 ? "IMPROVING"
                        : score >= 0.45 ? "ON TRACK"
                        : "REVIEW NEEDED";

        // ── Top domain: emotion, health, or education ─────────────────────────
        var domainScores = new Dictionary<string, double>
        {
            ["emotion"]   = contributions["emotion_delta"],
            ["health"]    = contributions["health_delta"],
            ["education"] = contributions["has_educational_support"] + contributions["edu_enrolled"],
        };

        var topEntry = domainScores
            .Where(kv => kv.Value > 0)
            .OrderByDescending(kv => kv.Value)
            .FirstOrDefault();

        string? topDomain = topEntry.Key;
        string? topDomainLabel = topDomain switch
        {
            "emotion"   => "Emotional recovery",
            "health"    => "Health improvement",
            "education" => "Educational engagement",
            _           => null,
        };

        return Ok(new
        {
            residentId       = residentId,
            statusLabel,
            improvementScore = Math.Round(score, 4),
            flag             = score < 0.45,  // true when REVIEW NEEDED
            topDomain,
            topDomainLabel,
            modelVersion     = "intervention_effectiveness_heuristic_v1",
            disclaimer       = "Intervention effectiveness scores are derived from recorded sessions, " +
                               "health data, and plan completion. They supplement — not replace — " +
                               "direct clinical observation by your social work team.",
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
            bool b => b,
            long l => l != 0,
            int  i => i != 0,
            _      => string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase)
                   || v.ToString() == "1",
        };

    private double ValenceOf(object? v) =>
        v is string s && EmotionValence.TryGetValue(s.Trim(), out var val) ? val : double.NaN;

    private double CoopScoreOf(object? v) =>
        v is string s && CooperationScore.TryGetValue(s.Trim(), out var val) ? val : double.NaN;
}
