import { apiFetch } from "./client";

export const getSafehouses = () => apiFetch<Record<string, unknown>[]>("/api/tables/safehouses");
