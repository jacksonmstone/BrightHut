import { apiFetch } from "./client";

export const getSupporters = () => apiFetch<Record<string, unknown>[]>("/api/tables/supporters");
