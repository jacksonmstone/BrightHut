import { apiFetch } from "./client";

export const getDonations = () => apiFetch<Record<string, unknown>[]>("/api/tables/donations");
export const getDonationAllocations = () => apiFetch<Record<string, unknown>[]>("/api/tables/donation_allocations");
export const getInKindDonationItems = () => apiFetch<Record<string, unknown>[]>("/api/tables/in_kind_donation_items");
