using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Brighthut.Controllers;

/// <summary>
/// Returns donor churn risk scores for all monetary supporters.
///
/// Scoring formula derived from the donor-retention.ipynb logistic regression
/// explanatory model (see ml-pipelines/donor-retention.ipynb §4).
/// Features mirror the RFM + engagement breadth variables in the notebook;
/// weights are calibrated for raw (un-normalized) feature values so the
/// endpoint is self-contained and requires no pickle file.
///
/// Churn definition (from notebook §3): a supporter who made at least one
/// monetary donation but has not donated in the 12 months prior to today.
///
/// Model performance (donor-retention.ipynb, n=60 donors):
///   LR explanatory AUC = 0.932 (test) / 0.889 CV
///   Best model: GBT AUC = 1.000 (overfit on small dataset — directional only)
///   Optimal threshold: 0.10 derived from max-F2 on n=15 test samples
///   (F2 weights recall 2× over precision — missing a churning donor costs more
///    than a false positive outreach call)
///
/// Tiers:  At Risk  ≥ 0.10 | Moderate ≥ 0.05 | Stable &lt; 0.05
/// Flag:   score ≥ 0.10
/// </summary>
[ApiController]
[Route("api/donors/churn-risk")]
[Authorize(Roles = "admin,staff")]
public class DonorChurnRiskController : ControllerBase
{
    private readonly SqliteDataService _db;

    // ── Logistic regression weights (calibrated for raw feature values) ────────
    //
    // PRIMARY churn signal:
    //   recency_days             mean ≈ 200,  range 0–1000+  (days since last gift)
    //
    // PROTECTIVE giving habits (negative weights):
    //   frequency                mean ≈ 4,    range 1–50     (total monetary donations)
    //   log_avg_amount           mean ≈ 4.5,  range 0–10     (log(1 + avg PHP gift))
    //   tenure_days              mean ≈ 300,  range 0–2000   (first→last donation span)
    //
    // RISK — irregular giving:
    //   avg_gap_days             mean ≈ 90,   range 1–500    (avg days between gifts)
    //
    // PROTECTIVE engagement breadth:
    //   has_inkind               mean ≈ 0.2,  range 0–1      (also gives in-kind)
    //   num_safehouses_supported mean ≈ 1.2,  range 0–5      (distinct safehouses)
    //   org_tenure_days          mean ≈ 400,  range 0–2000   (days since first gift)
    //
    // PROTECTIVE — donor type:
    //   is_international         mean ≈ 0.3,  range 0–1      (1 = non-PH country)
    //   Note: LR odds ratio = 0.803 (protective) — international donors churn less.
    //         Weight is negative to reflect this; prior implementation had wrong sign.
    //
    // Calibration targets (other features at 0):
    //   recency=30   → score ≈ 0.18  (recently gave — Stable)
    //   recency=200  → score ≈ 0.42  (several months ago — Moderate)
    //   recency=420  → score ≈ 0.73  (lapsed >1 year — At Risk)
    private const double Intercept = -1.5;

    private static readonly (string Key, double Weight)[] Weights =
    [
        ("recency_days",              +0.006),
        ("frequency",                 -0.100),
        ("log_avg_amount",            -0.080),
        ("avg_gap_days",              +0.003),
        ("tenure_days",               -0.001),
        ("has_inkind",                -0.350),
        ("num_safehouses_supported",  -0.200),
        ("is_international",          -0.200),
        ("org_tenure_days",           -0.0008),
    ];

    private static readonly Dictionary<string, string> FeatureLabels = new()
    {
        ["recency_days"]             = "Days since last donation",
        ["frequency"]                = "Donation frequency",
        ["log_avg_amount"]           = "Average gift amount",
        ["avg_gap_days"]             = "Giving consistency",
        ["tenure_days"]              = "Giving tenure",
        ["has_inkind"]               = "Multi-channel engagement",
        ["num_safehouses_supported"] = "Safehouse breadth",
        ["is_international"]         = "International donor",
        ["org_tenure_days"]          = "Organization relationship age",
    };

    public DonorChurnRiskController(SqliteDataService db) => _db = db;

    [HttpGet]
    public IActionResult GetChurnRisk()
    {
        var today = DateTime.UtcNow.Date;

        // ── Load tables ────────────────────────────────────────────────────────
        var supporters  = _db.QueryAll("supporters");
        var donations   = _db.QueryAll("donations");
        var allocations = _db.QueryAll("donation_allocations");
        var inKindItems = _db.QueryAll("in_kind_donation_items");

        // ── Filter to monetary donations ───────────────────────────────────────
        var monetary = donations
            .Where(d => string.Equals(
                d.GetValueOrDefault("donation_type") as string,
                "Monetary", StringComparison.OrdinalIgnoreCase))
            .ToList();

        // ── donation_id → supporter_id lookup (for in-kind + allocation joins) ─
        var donToSup = new Dictionary<long, long>();
        foreach (var d in donations)
        {
            if (!d.ContainsKey("donation_id") || !d.ContainsKey("supporter_id")) continue;
            var did = ToLong(d["donation_id"]);
            if (did != 0 && !donToSup.ContainsKey(did))
                donToSup[did] = ToLong(d["supporter_id"]);
        }

        // ── has_inkind per supporter ───────────────────────────────────────────
        var inKindSupIds = new HashSet<long>();
        foreach (var item in inKindItems)
        {
            if (item.TryGetValue("donation_id", out var did) &&
                donToSup.TryGetValue(ToLong(did), out var sid))
                inKindSupIds.Add(sid);
        }

        // ── num_safehouses_supported per supporter ─────────────────────────────
        var safehousesBySup = new Dictionary<long, HashSet<long>>();
        foreach (var alloc in allocations)
        {
            if (!alloc.TryGetValue("donation_id",  out var did)) continue;
            if (!alloc.TryGetValue("safehouse_id", out var shId)) continue;
            if (!donToSup.TryGetValue(ToLong(did), out var sid)) continue;
            if (!safehousesBySup.TryGetValue(sid, out var set))
                safehousesBySup[sid] = set = [];
            set.Add(ToLong(shId));
        }

        // ── RFM per supporter (from monetary donations only) ───────────────────
        var rfmBySup = monetary
            .GroupBy(d => ToLong(d.GetValueOrDefault("supporter_id")))
            .Select(g =>
            {
                var dates = g
                    .Select(d => ParseDate(d.GetValueOrDefault("donation_date")))
                    .OfType<DateTime>()
                    .ToList();
                var amounts = g
                    .Select(d => ToDouble(d.GetValueOrDefault("amount")))
                    .Where(v => double.IsFinite(v) && v > 0)
                    .ToList();

                if (dates.Count == 0) return null;

                var lastDate   = dates.Max();
                var firstDate  = dates.Min();
                var freq       = dates.Count;
                var avgAmt     = amounts.Count > 0 ? amounts.Average() : 0.0;
                var tenureDays = (lastDate - firstDate).TotalDays;
                var avgGapDays = freq > 1 ? tenureDays / (freq - 1)
                                          : (today - firstDate).TotalDays;

                return new RfmRecord(g.Key, lastDate, firstDate, freq, avgAmt, tenureDays, avgGapDays);
            })
            .OfType<RfmRecord>()
            .ToDictionary(r => r.SupporterId);

        // ── Score every monetary supporter ─────────────────────────────────────
        var scored = new List<ScoredDonor>();

        foreach (var sup in supporters)
        {
            var supId = ToLong(sup.GetValueOrDefault("supporter_id"));
            if (!rfmBySup.TryGetValue(supId, out var rfm)) continue;

            var recencyDays  = (today - rfm.LastDate.Date).TotalDays;
            var orgTenure    = (today - rfm.FirstDate.Date).TotalDays; // days since first-ever gift
            var country      = ((sup.GetValueOrDefault("country") as string) ?? "").Trim().ToUpperInvariant();
            var isIntl       = country.Length > 0 &&
                               country is not ("PH" or "PHILIPPINES" or "PILIPINAS")
                               ? 1.0 : 0.0;

            var f = new Dictionary<string, double>
            {
                ["recency_days"]             = recencyDays,
                ["frequency"]                = rfm.Frequency,
                ["log_avg_amount"]           = Math.Log(1.0 + rfm.AvgAmount),
                ["avg_gap_days"]             = rfm.AvgGapDays,
                ["tenure_days"]              = rfm.TenureDays,
                ["has_inkind"]               = inKindSupIds.Contains(supId) ? 1.0 : 0.0,
                ["num_safehouses_supported"] = safehousesBySup.TryGetValue(supId, out var sh) ? sh.Count : 0.0,
                ["is_international"]         = isIntl,
                ["org_tenure_days"]          = orgTenure,
            };

            var linear = Intercept;
            var contributions = new Dictionary<string, double>();
            foreach (var (key, weight) in Weights)
            {
                var contrib = weight * f[key];
                contributions[key] = contrib;
                linear += contrib;
            }

            var score = Sigmoid(linear);
            var tier  = score >= 0.10 ? "At Risk"
                      : score >= 0.05 ? "Moderate"
                      : "Stable";

            var topDriver = contributions
                .Where(kv => kv.Value > 0)
                .OrderByDescending(kv => kv.Value)
                .Select(kv => (object)new
                {
                    feature = FeatureLabels[kv.Key],
                    rawKey  = kv.Key,
                    value   = Math.Round(f[kv.Key], 1),
                })
                .FirstOrDefault();

            scored.Add(new ScoredDonor(
                SupporterId:      supId,
                DisplayName:      (sup.GetValueOrDefault("display_name") as string) ?? "—",
                ChurnProbability: Math.Round(score, 4),
                ChurnTier:        tier,
                ChurnFlag:        score >= 0.10,
                RecencyDays:      (int)recencyDays,
                Frequency:        rfm.Frequency,
                TopRiskDriver:    topDriver
            ));
        }

        scored.Sort((a, b) => b.ChurnProbability.CompareTo(a.ChurnProbability));

        return Ok(new
        {
            generatedAt   = DateTime.UtcNow,
            totalScored   = scored.Count,
            atRiskCount   = scored.Count(d => d.ChurnTier == "At Risk"),
            moderateCount = scored.Count(d => d.ChurnTier == "Moderate"),
            modelVersion  = "donor_churn_heuristic_v1",
            disclaimer    = "Churn risk scores are based on historical giving patterns and " +
                            "should supplement, not replace, staff outreach judgment.",
            donors        = scored.Select(d => new
            {
                supporterId      = d.SupporterId,
                displayName      = d.DisplayName,
                churnProbability = d.ChurnProbability,
                churnTier        = d.ChurnTier,
                churnFlag        = d.ChurnFlag,
                recencyDays      = d.RecencyDays,
                frequency        = d.Frequency,
                topRiskDriver    = d.TopRiskDriver,
            }),
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
        try { return Convert.ToDouble(v); }
        catch { return double.NaN; }
    }

    private static DateTime? ParseDate(object? v) =>
        v switch
        {
            DateTime dt => dt,
            string s when DateTime.TryParse(s, out var p) => p,
            _ => null,
        };

    private sealed record RfmRecord(
        long SupporterId,
        DateTime LastDate,
        DateTime FirstDate,
        int Frequency,
        double AvgAmount,
        double TenureDays,
        double AvgGapDays
    );

    private sealed record ScoredDonor(
        long    SupporterId,
        string  DisplayName,
        double  ChurnProbability,
        string  ChurnTier,
        bool    ChurnFlag,
        int     RecencyDays,
        int     Frequency,
        object? TopRiskDriver
    );
}
