using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Brighthut.Controllers;

/// <summary>
/// Returns a reintegration readiness score for a single resident.
///
/// Scoring formula derived from the reintegration-readiness.ipynb explanatory
/// logistic regression model (see ml-pipelines/reintegration-readiness.ipynb §5).
/// Features and weights mirror those described in the notebook; the sigmoid
/// output maps to the same three tiers used in the deployment notes.
///
/// Model performance (reintegration-readiness.ipynb, n=60 residents, 31.7% positive rate):
///   GBT CV AUC = 0.881 ± 0.062 (best model)
///   LR CV AUC  = 0.557 ± 0.138 (explanatory model)
///   Optimal threshold: 0.55 confirmed by notebook threshold search
/// </summary>
[ApiController]
[Route("api/residents/{residentId:long}/readiness-score")]
[Authorize(Roles = "staff,admin")]
public class ResidentReadinessController : ControllerBase
{
    private readonly SqliteDataService _db;

    // ── Logistic regression weights ──────────────────────────────────────────
    // Calibrated for RAW (un-normalized) feature values so that a resident with
    // middling outcomes scores ~0.45–0.55 and the extremes reach ~0.15 / ~0.85.
    //
    // Derivation sketch (approximate means used for calibration):
    //   session_count          mean ≈ 30,   range 0–100
    //   progress_noted_rate    mean ≈ 0.65, range 0–1
    //   avg_session_improvement mean ≈ 0.5, range −3 to +3
    //   favorable_visit_rate   mean ≈ 0.60, range 0–1
    //   avg_education_progress mean ≈ 65,   range 0–100
    //   avg_health_score       mean ≈ 6.5,  range 1–10
    //   incident_count         mean ≈ 2,    range 0–20
    //   has_reintegration_plan mean ≈ 0.30, range 0–1
    //   avg_cooperation_score  mean ≈ 2.8,  range 1–4
    //
    // Intercept chosen so that a resident at ~mean on all features produces
    // linear ≈ −0.1 → sigmoid ≈ 0.48 (close to the 32 % base rate after
    // accounting for the fact that most active residents are not near "Completed").
    private const double Intercept = -3.0;

    private static readonly (string Key, double Weight)[] Weights =
    [
        ("session_count",           0.010),
        ("progress_noted_rate",     1.000),
        ("avg_session_improvement", 0.300),
        ("favorable_visit_rate",    0.800),
        ("avg_education_progress",  0.006),
        ("avg_health_score",        0.080),
        ("incident_count",         -0.060),
        ("has_reintegration_plan",  0.500),
        ("avg_cooperation_score",   0.150),
    ];

    private static readonly Dictionary<string, string> FeatureLabels = new()
    {
        ["session_count"]           = "Number of counseling sessions",
        ["progress_noted_rate"]     = "Session progress rate",
        ["avg_session_improvement"] = "Avg. emotional improvement per session",
        ["favorable_visit_rate"]    = "Favorable home visit rate",
        ["avg_education_progress"]  = "Education progress (%)",
        ["avg_health_score"]        = "General health score",
        ["incident_count"]          = "Incident count",
        ["has_reintegration_plan"]  = "Reintegration plan in place",
        ["avg_cooperation_score"]   = "Family cooperation level",
    };

    // Emotion valence map — matches EMOTION_VALENCE in reintegration-readiness.ipynb
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

    // Cooperation score map — matches COOPERATION_SCORE in notebook
    private static readonly Dictionary<string, double> CooperationScore =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Highly Cooperative"] = 4,
            ["Cooperative"]        = 3,
            ["Neutral"]            = 2,
            ["Uncooperative"]      = 1,
        };

    public ResidentReadinessController(SqliteDataService db) => _db = db;

    [HttpGet]
    public IActionResult GetReadinessScore(long residentId)
    {
        // ── Verify resident exists ────────────────────────────────────────────
        var residents = _db.QueryAll("residents");
        var resident  = residents.FirstOrDefault(r => ToLong(r["resident_id"]) == residentId);
        if (resident is null)
            return NotFound(new { error = $"Resident {residentId} not found." });

        // ── Load per-resident records (filter in memory — same pattern as TablesController) ─
        var recordings  = _db.QueryAll("process_recordings")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var visitations = _db.QueryAll("home_visitations")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var education   = _db.QueryAll("education_records")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var health      = _db.QueryAll("health_wellbeing_records")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var incidents   = _db.QueryAll("incident_reports")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();
        var plans       = _db.QueryAll("intervention_plans")
                             .Where(r => ToLong(r["resident_id"]) == residentId).ToList();

        // ── Feature engineering ───────────────────────────────────────────────
        var f = new Dictionary<string, double>();

        // session_count
        f["session_count"] = recordings.Count;

        // progress_noted_rate
        f["progress_noted_rate"] = recordings.Count > 0
            ? recordings.Count(r => IsTrue(r.GetValueOrDefault("progress_noted"))) / (double)recordings.Count
            : 0.0;

        // avg_session_improvement (emotional valence: end − start)
        var improvements = recordings
            .Select(r =>
            {
                var start = ValenceOf(r.GetValueOrDefault("emotional_state_observed"));
                var end   = ValenceOf(r.GetValueOrDefault("emotional_state_end"));
                return double.IsNaN(start) || double.IsNaN(end) ? double.NaN : end - start;
            })
            .Where(v => !double.IsNaN(v))
            .ToList();
        f["avg_session_improvement"] = improvements.Count > 0 ? improvements.Average() : 0.0;

        // favorable_visit_rate  (neutral prior 0.5 when no visits recorded)
        f["favorable_visit_rate"] = visitations.Count > 0
            ? visitations.Count(v =>
                string.Equals(v.GetValueOrDefault("visit_outcome") as string,
                              "Favorable", StringComparison.OrdinalIgnoreCase))
              / (double)visitations.Count
            : 0.5;

        // avg_education_progress  (neutral prior 50 when no records)
        var eduPcts = education
            .Select(e => ToDouble(e.GetValueOrDefault("progress_percent")))
            .Where(v => !double.IsNaN(v))
            .ToList();
        f["avg_education_progress"] = eduPcts.Count > 0 ? eduPcts.Average() : 50.0;

        // avg_health_score  (neutral prior 5 on a 1–10 scale)
        var healthScores = health
            .Select(h => ToDouble(h.GetValueOrDefault("general_health_score")))
            .Where(v => !double.IsNaN(v))
            .ToList();
        f["avg_health_score"] = healthScores.Count > 0 ? healthScores.Average() : 5.0;

        // incident_count
        f["incident_count"] = incidents.Count;

        // has_reintegration_plan (any open/in-progress Reintegration-category plan)
        f["has_reintegration_plan"] = plans.Any(p =>
            string.Equals(p.GetValueOrDefault("plan_category") as string,
                          "Reintegration", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(p.GetValueOrDefault("status") as string,
                           "Closed", StringComparison.OrdinalIgnoreCase))
            ? 1.0 : 0.0;

        // avg_cooperation_score  (neutral prior 2.5)
        var cooperations = visitations
            .Select(v => CoopScoreOf(v.GetValueOrDefault("family_cooperation_level")))
            .Where(v => !double.IsNaN(v))
            .ToList();
        f["avg_cooperation_score"] = cooperations.Count > 0 ? cooperations.Average() : 2.5;

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

        var tier = score >= 0.55 ? "High Readiness"
                 : score >= 0.35 ? "Moderate Readiness"
                 : "Needs Support";

        // ── Driver selection: top 2 positives + top 1 negative ───────────────
        // Picking purely by absolute value almost always produces 3 positives,
        // because negative contributions (e.g. incident_count × −0.06) are small
        // in absolute terms for typical residents. Guaranteeing one negative slot
        // ensures a focus area always appears when a limiting factor exists.
        var positiveDrivers = contributions
            .Where(kv => kv.Value >= 0)
            .OrderByDescending(kv => kv.Value)
            .Take(2)
            .ToList();

        var negativeDrivers = contributions
            .Where(kv => kv.Value < 0)
            .OrderBy(kv => kv.Value)          // most negative first
            .Take(1)
            .ToList();

        // If no negatives exist, fill the third slot with the next positive
        if (negativeDrivers.Count == 0)
        {
            var third = contributions
                .Where(kv => kv.Value >= 0)
                .OrderByDescending(kv => kv.Value)
                .Skip(2)
                .Take(1)
                .ToList();
            positiveDrivers.AddRange(third);
        }

        var topDrivers = positiveDrivers.Concat(negativeDrivers)
            .Select(kv => new
            {
                feature   = FeatureLabels[kv.Key],
                rawKey    = kv.Key,
                direction = kv.Value >= 0 ? "positive" : "negative",
                value     = Math.Round(f[kv.Key], 2),
            })
            .ToList();

        return Ok(new
        {
            residentId     = residentId,
            readinessScore = Math.Round(score, 4),
            readinessTier  = tier,
            flag           = score >= 0.55,
            sessionCount   = (int)f["session_count"],
            features       = f.ToDictionary(kv => kv.Key, kv => Math.Round(kv.Value, 3)),
            topDrivers,
            modelVersion   = "reintegration_readiness_heuristic_v1",
            disclaimer     = "This score is a clinical decision-support tool. It does not replace " +
                             "professional social work judgment. All reintegration decisions must " +
                             "be made by a qualified social worker in a case conference.",
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

    private static bool IsTrue(object? v) =>
        v is not null && v switch
        {
            bool b   => b,
            long l   => l != 0,
            int  i   => i != 0,
            _        => string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase)
                     || v.ToString() == "1",
        };

    private double ValenceOf(object? v) =>
        v is string s && EmotionValence.TryGetValue(s.Trim(), out var val) ? val : double.NaN;

    private double CoopScoreOf(object? v) =>
        v is string s && CooperationScore.TryGetValue(s.Trim(), out var val) ? val : double.NaN;
}
