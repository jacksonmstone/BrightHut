import { apiFetch } from "./client";

export const getResidents = () => apiFetch<Record<string, unknown>[]>("/api/tables/residents");
export const getProcessRecordings = () => apiFetch<Record<string, unknown>[]>("/api/tables/process_recordings");
export const getHomeVisitations = () => apiFetch<Record<string, unknown>[]>("/api/tables/home_visitations");
export const getEducationRecords = () => apiFetch<Record<string, unknown>[]>("/api/tables/education_records");
export const getHealthRecords = () => apiFetch<Record<string, unknown>[]>("/api/tables/health_wellbeing_records");
export const getInterventionPlans = () => apiFetch<Record<string, unknown>[]>("/api/tables/intervention_plans");
export const getIncidentReports = () => apiFetch<Record<string, unknown>[]>("/api/tables/incident_reports");

// ── Reintegration Readiness ML model output ──────────────────────────────────
// Served by ResidentReadinessController.cs (staff/admin only).
// Scores are computed server-side from the logistic regression weights
// derived in ml-pipelines/reintegration-readiness.ipynb.

export interface ReadinessDriver {
  feature: string
  rawKey: string
  direction: 'positive' | 'negative'
  value: number
}

export interface ReadinessScore {
  residentId: number
  readinessScore: number          // 0–1 probability
  readinessTier: 'High Readiness' | 'Moderate Readiness' | 'Needs Support'
  flag: boolean                   // true when score >= deployment threshold (0.55)
  sessionCount: number
  topDrivers: ReadinessDriver[]
  modelVersion: string
  disclaimer: string
}

/** Fetch the readiness score for one resident. Requires staff or admin JWT. */
export const getResidentReadinessScore = (residentId: number) =>
  apiFetch<ReadinessScore>(`/api/residents/${residentId}/readiness-score`)

// ── Regression Risk ML model output ──────────────────────────────────────────
// Served by ResidentRegressionRiskController.cs (staff/admin only).
// Scores are computed server-side from logistic regression weights
// derived in ml-pipelines/resident-regression-risk.ipynb.

export interface RegressionRiskDriver {
  feature: string
  rawKey: string
  value: number
}

export interface RegressionRisk {
  residentId: number
  riskScore: number                               // 0–1 probability (higher = more risk)
  riskTier: 'High Risk' | 'Moderate Risk' | 'Stable'
  flag: boolean                                   // true when score >= 0.50
  topRiskDrivers: RegressionRiskDriver[]          // factors actively increasing risk
  modelVersion: string
  disclaimer: string
}

/** Fetch the regression risk score for one resident. Requires staff or admin JWT. */
export const getResidentRegressionRisk = (residentId: number) =>
  apiFetch<RegressionRisk>(`/api/residents/${residentId}/regression-risk`)

// ── Intervention Effectiveness ML model output ────────────────────────────────
// Served by InterventionEffectivenessController.cs (staff/admin only).
// Scores are computed server-side from logistic regression weights
// derived in ml-pipelines/intervention-effectiveness.ipynb.

export interface InterventionEffectiveness {
  residentId: number
  statusLabel: 'IMPROVING' | 'ON TRACK' | 'REVIEW NEEDED' | 'INSUFFICIENT DATA'
  improvementScore: number | null   // null when INSUFFICIENT DATA
  flag: boolean                     // true when REVIEW NEEDED (score < 0.45)
  topDomain: 'emotion' | 'health' | 'education' | null
  topDomainLabel: string | null
  modelVersion: string
  disclaimer: string
}

/** Fetch the intervention effectiveness score for one resident. Requires staff or admin JWT. */
export const getInterventionEffectiveness = (residentId: number) =>
  apiFetch<InterventionEffectiveness>(`/api/residents/${residentId}/intervention-effectiveness`)
