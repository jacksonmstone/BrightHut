import { apiFetch } from "./client";

export const getSocialMediaPosts = () => apiFetch<Record<string, unknown>[]>("/api/tables/social_media_posts");
