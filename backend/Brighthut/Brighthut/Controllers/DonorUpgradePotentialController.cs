using Brighthut.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Brighthut.Controllers;

/// <summary>
/// Returns donor upgrade-potential scores for all monetary supporters.
///
/// Scoring formula derived from the donor-upgrade-potential.ipynb GBT/LR pipeline
/// (see ml-pipelines/donor-upgrade-potential.ipynb §3–4).
/// Features mirror the giving-trajectory + RFM + engagement variables in the notebook;
/// weights are calibrated for raw (un-normalized) feature values so the endpoint
/// is self-contained and requires no pickle file.
///
/// Upgrade definition (from notebook §1): a donor whose recent-window average gift
/// is ≥ 1.5× their historical-window average (recent window = last 180 days).
///
/// Model performance (donor-upgrade-potential.ipynb, n=38 donors, 42% upgrade rate):
///   GBT CV AUC = 0.978, test AUC = 1.000 (overfit — directional only)
///   LR failed (singular matrix — near-perfect collinearity on small dataset)
///   Notebook GBT threshold: 0.878 on n=8 test samples — too aggressive to apply directly.
///   Using 0.65/0.40 as a conservative adjustment toward the notebook's direction.
///
/// Tiers:  HIGH   ≥ 0.65 | MEDIUM ≥ 0.40 | LOW &lt; 0.40
/// Flag:   score ≥ 0.50
///
/// Calibration targets (other features at typical values):
///   flat/declining donor      → score ≈ 0.25  (LOW)
///   steadily growing donor    → score ≈ 0.65  (MEDIUM/HIGH boundary)
///   strongly accelerating     → score ≈ 0.85  (HIGH)
/// </summary>
[ApiController]
[Route("api/donors/upgrade-potential")]
[Authorize(Roles = "admin,staff")]
public class DonorUpgradePotentialController : ControllerBase
{
    private readonly SqliteDataService _db;

    // ── Logistic regression weights (calibrated for raw feature values) ────────
    //
    // UPGRADE signals (positive weights):
    //   frequency                mean ≈ 4,    range 1–50     (total monetary donations)
    //   log_avg_amount           mean ≈ 4.5,  range 0–10     (log(1 + avg PHP gift))
    //   giving_slope             mean ≈ 0.5,  range −100–100 (PHP/day linear trend, capped)
    //   pct_increases            mean ≈ 0.4,  range 0–1      (% of gift pairs that increased)
    //   tenure_days              mean ≈ 300,  range 0–2000   (first→last donation span)
    //   has_inkind               mean ≈ 0.2,  range 0–1      (also gives in-kind)
    //   num_safehouses_supported mean ≈ 1.2,  range 0–5      (distinct safehouses)
    //   is_international         mean ≈ 0.3,  range 0–1      (broader donor base)
    //   freq_accel               mean ≈ 0,    range −1–1     (recent vs. historical half frequency)
    //
    // DAMPENERS (negative weights):
    //   recency_days             mean ≈ 200,  range 0–1000+  (days since last gift — lapsed = less likely)
    //   avg_gap_days             mean ≈ 90,   range 1–500    (shorter gap = more engaged)
    //   cv_amount                mean ≈ 0.5,  range 0–5      (volatile giving = unpredictable, capped at 5)
    private const double Intercept = -1.8;

    private static readonly (string Key, double Weight)[] Weights =
    [
        ("recency_days",             -0.005),
        ("frequency",                +0.080),
        ("log_avg_amount",           +0.100),
        ("giving_slope",             +0.010),
        ("pct_increases",            +0.800),
        ("avg_gap_days",             -0.002),
        ("tenure_days",              +0.0005),
        ("has_inkind",               +0.300),
        ("num_safehouses_supported", +0.200),
        ("is_international",         +0.150),
        ("freq_accel",               +0.400),
        ("cv_amount",                -0.150),
    ];

    private static readonly Dictionary<string, string> FeatureLabels = new()
    {
        ["recency_days"]             = "Recent donation activity",
        ["frequency"]                = "Donation frequency",
        ["log_avg_amount"]           = "Average gift size",
        ["giving_slope"]             = "Upward giving trend",
        ["pct_increases"]            = "History of gift increases",
        ["avg_gap_days"]             = "Giving consistency",
        ["tenure_days"]              = "Relationship tenure",
        ["has_inkind"]               = "Multi-channel engagement",
        ["num_safehouses_supported"] = "Safehouse breadth",
        ["is_international"]         = "International supporter",
        ["freq_accel"]               = "Accelerating giving frequency",
        ["cv_amount"]                = "Giving stability",
    };

    public DonorUpgradePotentialController(SqliteDataService db) => _db = db;

    [HttpGet]
    public IActionResult GetUpgradePotential()
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

        // ── donation_id → supporter_id lookup ─────────────────────────────────
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
            if (!alloc.TryGetValue("donation_id",  out var did))  continue;
            if (!alloc.TryGetValue("safehouse_id", out var shId)) continue;
            if (!donToSup.TryGetValue(ToLong(did), out var sid))  continue;
            if (!safehousesBySup.TryGetValue(sid, out var set))
                safehousesBySup[sid] = set = [];
            set.Add(ToLong(shId));
        }

        // ── Giving-trajectory features per supporter ───────────────────────────
        var featuresBySup = monetary
            .GroupBy(d => ToLong(d.GetValueOrDefault("supporter_id")))
            .Select(g =>
            {
                var sorted = g
                    .Select(d => (
                        Date:   ParseDate(d.GetValueOrDefault("donation_date")),
                        Amount: ToDouble(d.GetValueOrDefault("amount"))
                    ))
                    .Where(x => x.Date.HasValue && double.IsFinite(x.Amount) && x.Amount > 0)
                    .OrderBy(x => x.Date)
                    .ToList();

                if (sorted.Count == 0) return null;

                var dates   = sorted.Select(x => x.Date!.Value).ToList();
                var amounts = sorted.Select(x => x.Amount).ToList();

                var lastDate   = dates.Max();
                var firstDate  = dates.Min();
                var freq       = sorted.Count;
                var avgAmt     = amounts.Average();
                var tenureDays = (lastDate - firstDate).TotalDays;
                var avgGapDays = freq > 1 ? tenureDays / (freq - 1)
                                          : (today - firstDate.Date).TotalDays;

                // ── giving_slope: linear trend of amounts over time (PHP/day) ──
                double givingSlope = 0;
                if (freq >= 2)
                {
                    var xs  = dates.Select(dt => (dt - firstDate).TotalDays).ToList();
                    var xMn = xs.Average();
                    var yMn = avgAmt;
                    double num = 0, den = 0;
                    for (var i = 0; i < freq; i++)
                    {
                        var dx = xs[i] - xMn;
                        num += dx * (amounts[i] - yMn);
                        den += dx * dx;
                    }
                    givingSlope = den < 1e-10 ? 0 : num / den;
                    // Cap to avoid extreme values dominating the score
                    givingSlope = Math.Clamp(givingSlope, -100.0, 100.0);
                }

                // ── pct_increases: % of consecutive gift pairs that increased ──
                double pctIncreases = 0;
                if (freq >= 2)
                {
                    var increases = 0;
                    for (var i = 1; i < freq; i++)
                        if (amounts[i] > amounts[i - 1]) increases++;
                    pctIncreases = (double)increases / (freq - 1);
                }

                // ── cv_amount: coefficient of variation (std / mean) ──────────
                double cvAmount = 0;
                if (freq >= 2 && avgAmt > 0)
                {
                    var variance = amounts.Sum(a => (a - avgAmt) * (a - avgAmt)) / freq;
                    cvAmount = Math.Sqrt(variance) / avgAmt;
                    cvAmount = Math.Min(cvAmount, 5.0); // cap at 5
                }

                // ── freq_accel: recent-half vs. historical-half donation rate ──
                double freqAccel = 0;
                if (freq >= 4 && tenureDays > 0)
                {
                    var midDate  = firstDate.AddDays(tenureDays / 2);
                    var histHalf = dates.Count(dt => dt <= midDate);
                    var recHalf  = freq - histHalf;
                    // Normalize: (recent - historical) / total  →  range roughly [-1, 1]
                    freqAccel = (double)(recHalf - histHalf) / freq;
                    freqAccel = Math.Clamp(freqAccel, -1.0, 1.0);
                }

                return new UpgradeFeatures(
                    SupporterId:   g.Key,
                    LastDate:      lastDate,
                    FirstDate:     firstDate,
                    Frequency:     freq,
                    AvgAmount:     avgAmt,
                    TenureDays:    tenureDays,
                    AvgGapDays:    avgGapDays,
                    GivingSlope:   givingSlope,
                    PctIncreases:  pctIncreases,
                    CvAmount:      cvAmount,
                    FreqAccel:     freqAccel
                );
            })
            .OfType<UpgradeFeatures>()
            .ToDictionary(r => r.SupporterId);

        // ── Score every monetary supporter ─────────────────────────────────────
        var scored = new List<ScoredDonor>();

        foreach (var sup in supporters)
        {
            var supId = ToLong(sup.GetValueOrDefault("supporter_id"));
            if (!featuresBySup.TryGetValue(supId, out var uf)) continue;

            var recencyDays = (today - uf.LastDate.Date).TotalDays;
            var country     = ((sup.GetValueOrDefault("country") as string) ?? "").Trim().ToUpperInvariant();
            var isIntl      = country.Length > 0 &&
                              country is not ("PH" or "PHILIPPINES" or "PILIPINAS")
                              ? 1.0 : 0.0;

            var f = new Dictionary<string, double>
            {
                ["recency_days"]             = recencyDays,
                ["frequency"]                = uf.Frequency,
                ["log_avg_amount"]           = Math.Log(1.0 + uf.AvgAmount),
                ["giving_slope"]             = uf.GivingSlope,
                ["pct_increases"]            = uf.PctIncreases,
                ["avg_gap_days"]             = uf.AvgGapDays,
                ["tenure_days"]              = uf.TenureDays,
                ["has_inkind"]               = inKindSupIds.Contains(supId) ? 1.0 : 0.0,
                ["num_safehouses_supported"] = safehousesBySup.TryGetValue(supId, out var sh) ? sh.Count : 0.0,
                ["is_international"]         = isIntl,
                ["freq_accel"]               = uf.FreqAccel,
                ["cv_amount"]                = uf.CvAmount,
            };

            var linear        = Intercept;
            var contributions = new Dictionary<string, double>();
            foreach (var (key, weight) in Weights)
            {
                var contrib = weight * f[key];
                contributions[key] = contrib;
                linear += contrib;
            }

            var score = Sigmoid(linear);
            var tier  = score >= 0.65 ? "HIGH"
                      : score >= 0.40 ? "MEDIUM"
                      : "LOW";

            // Top positive contributor (the main reason this donor looks upgrade-ready)
            var topSignal = contributions
                .Where(kv => kv.Value > 0)
                .OrderByDescending(kv => kv.Value)
                .Select(kv => (object)new
                {
                    feature = FeatureLabels[kv.Key],
                    rawKey  = kv.Key,
                    value   = Math.Round(f[kv.Key], 2),
                })
                .FirstOrDefault();

            scored.Add(new ScoredDonor(
                SupporterId:       supId,
                DisplayName:       (sup.GetValueOrDefault("display_name") as string) ?? "—",
                UpgradeProbability: Math.Round(score, 4),
                UpgradeTier:       tier,
                UpgradeFlag:       score >= 0.50,
                RecencyDays:       (int)recencyDays,
                Frequency:         uf.Frequency,
                GivingSlope:       Math.Round(uf.GivingSlope, 2),
                PctIncreases:      Math.Round(uf.PctIncreases, 3),
                TopUpgradeSignal:  topSignal
            ));
        }

        scored.Sort((a, b) => b.UpgradeProbability.CompareTo(a.UpgradeProbability));

        return Ok(new
        {
            generatedAt    = DateTime.UtcNow,
            totalScored    = scored.Count,
            highCount      = scored.Count(d => d.UpgradeTier == "HIGH"),
            mediumCount    = scored.Count(d => d.UpgradeTier == "MEDIUM"),
            modelVersion   = "donor_upgrade_heuristic_v1",
            disclaimer     = "Upgrade scores predict which donors may give more if asked. " +
                             "Use as a guide for prioritizing outreach, not as a guarantee.",
            donors         = scored.Select(d => new
            {
                supporterId        = d.SupporterId,
                displayName        = d.DisplayName,
                upgradeProbability = d.UpgradeProbability,
                upgradeTier        = d.UpgradeTier,
                upgradeFlag        = d.UpgradeFlag,
                recencyDays        = d.RecencyDays,
                frequency          = d.Frequency,
                givingSlope        = d.GivingSlope,
                pctIncreases       = d.PctIncreases,
                topUpgradeSignal   = d.TopUpgradeSignal,
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

    private sealed record UpgradeFeatures(
        long     SupporterId,
        DateTime LastDate,
        DateTime FirstDate,
        int      Frequency,
        double   AvgAmount,
        double   TenureDays,
        double   AvgGapDays,
        double   GivingSlope,
        double   PctIncreases,
        double   CvAmount,
        double   FreqAccel
    );

    private sealed record ScoredDonor(
        long    SupporterId,
        string  DisplayName,
        double  UpgradeProbability,
        string  UpgradeTier,
        bool    UpgradeFlag,
        int     RecencyDays,
        int     Frequency,
        double  GivingSlope,
        double  PctIncreases,
        object? TopUpgradeSignal
    );
}
