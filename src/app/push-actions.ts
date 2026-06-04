"use server";

import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions";

// Mirrors the UUID validation used in actions.ts (kept local because a
// "use server" module may only export async functions).
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 512;
const MAX_USER_AGENT_LENGTH = 512;

type SavePushSubscriptionInput = {
  profileId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

function isValidEndpoint(endpoint: string): boolean {
  if (endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return false;
  }

  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

function isValidKey(value: string): boolean {
  return value.length > 0 && value.length <= MAX_KEY_LENGTH;
}

export async function savePushSubscription(
  input: SavePushSubscriptionInput
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const profileId = input.profileId?.trim() ?? "";
  const endpoint = input.endpoint?.trim() ?? "";
  const p256dh = input.p256dh?.trim() ?? "";
  const auth = input.auth?.trim() ?? "";
  const userAgent = input.userAgent?.trim().slice(0, MAX_USER_AGENT_LENGTH) || null;

  if (!uuidPattern.test(profileId)) {
    return { ok: false, error: "Choose a profile before enabling reminders." };
  }

  if (!isValidEndpoint(endpoint)) {
    return { ok: false, error: "Invalid push subscription endpoint." };
  }

  if (!isValidKey(p256dh) || !isValidKey(auth)) {
    return { ok: false, error: "Invalid push subscription keys." };
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase credentials are missing." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deletePushSubscription(
  endpoint: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const trimmedEndpoint = endpoint?.trim() ?? "";

  if (!isValidEndpoint(trimmedEndpoint)) {
    return { ok: false, error: "Invalid push subscription endpoint." };
  }

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { ok: false, error: "Supabase credentials are missing." };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", trimmedEndpoint);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
