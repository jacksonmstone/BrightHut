import { apiFetch } from "./client";

export const getResidents = () => apiFetch<Record<string, unknown>[]>("/api/tables/residents");
