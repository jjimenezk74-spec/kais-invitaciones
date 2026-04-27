/**
 * invitation-themes.server.ts
 * Server-only DB access for the category + theme system.
 * Importing this in a client component will throw a build error.
 *
 * Client-safe helpers live in: lib/invitation-themes.ts
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { EventCategory, InvitationTheme } from "@/lib/types";

// Re-export client-safe helpers so callers can use a single import path
// when they are already in a server context.
export * from "@/lib/invitation-themes";

// ─── Category fetches ─────────────────────────────────────────────────────────

/** Fetches all active categories ordered by sort_order. */
export async function fetchActiveCategories(): Promise<EventCategory[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("event_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as EventCategory[];
}

// ─── Theme fetches ────────────────────────────────────────────────────────────

/** Fetches all active themes ordered by sort_order. */
export async function fetchActiveThemes(): Promise<InvitationTheme[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitation_themes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as InvitationTheme[];
}

/** Fetches active themes for a specific category (by category UUID). */
export async function fetchThemesByCategoryId(categoryId: string): Promise<InvitationTheme[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitation_themes")
    .select("*")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as InvitationTheme[];
}

/** Fetches a single active theme by its UUID. */
export async function fetchThemeById(id: string): Promise<InvitationTheme | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitation_themes")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return (data ?? null) as InvitationTheme | null;
}

/** Fetches a single active theme by its slug. */
export async function fetchThemeBySlug(slug: string): Promise<InvitationTheme | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitation_themes")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return (data ?? null) as InvitationTheme | null;
}
