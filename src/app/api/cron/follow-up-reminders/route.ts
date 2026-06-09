import { timingSafeEqual } from "node:crypto";

import {
  sendNotification,
  setVapidDetails,
  WebPushError,
  type PushSubscription,
} from "web-push";

import { listPeople } from "@/app/actions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getFollowUpStatus } from "@/lib/follow-ups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BEARER_PREFIX = "Bearer ";

type PushSubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Constant-time-ish comparison that first short-circuits on length mismatch. */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isAuthorized(request: Request, secret: string): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith(BEARER_PREFIX)
    ? authHeader.slice(BEARER_PREFIX.length)
    : "";
  const querySecret = new URL(request.url).searchParams.get("secret") ?? "";
  const provided = bearerToken || querySecret;

  return provided.length > 0 && secretsMatch(provided, secret);
}

/** "Kazik, Adam, and 4 others need follow-up." — up to 2 names then a count. */
function buildDigestBody(names: string[]): string {
  if (names.length === 1) {
    return `${names[0]} needs follow-up.`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} need follow-up.`;
  }

  const remaining = names.length - 2;

  return `${names[0]}, ${names[1]}, and ${remaining} other${
    remaining === 1 ? "" : "s"
  } need follow-up.`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  if (!isAuthorized(request, cronSecret)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return Response.json(
      { ok: false, error: "VAPID keys are not configured." },
      { status: 500 }
    );
  }

  setVapidDetails(subject, publicKey, privateKey);

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return Response.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 500 }
    );
  }

  // Reuse the board's data loader so the cron sees exactly the same active
  // contacts (archived filtering, legacy stage promotion, hydrated studies/events).
  const board = await listPeople();

  if (!board.configured) {
    return Response.json(
      { ok: false, error: board.error ?? "Board is not configured." },
      { status: 500 }
    );
  }

  const now = Date.now();
  const overduePeople = board.people.filter(
    (person) => getFollowUpStatus(person, { now }).isOverdue
  );

  const { data: subscriptionRows, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth");

  if (subscriptionError) {
    return Response.json(
      { ok: false, error: subscriptionError.message },
      { status: 500 }
    );
  }

  const subscriptionsByProfile = new Map<string, PushSubscriptionRow[]>();

  for (const row of subscriptionRows ?? []) {
    const list = subscriptionsByProfile.get(row.profile_id) ?? [];
    list.push(row);
    subscriptionsByProfile.set(row.profile_id, list);
  }

  let profilesNotified = 0;
  let pushesSent = 0;
  let staleRemoved = 0;

  for (const profile of board.profiles) {
    const subscriptions = subscriptionsByProfile.get(profile.id);

    if (!subscriptions || subscriptions.length === 0) {
      continue;
    }

    // A profile is only reminded about the contacts it entered
    // (created_by_profile_id), matching the in-app reminders. Sort by
    // quietest-first to mirror the board's ordering.
    const contacts = overduePeople
      .filter((person) => person.created_by_profile_id === profile.id)
      .map((person) => ({
        person,
        daysQuiet: getFollowUpStatus(person, { now }).daysQuiet,
      }))
      .sort((a, b) => b.daysQuiet - a.daysQuiet);

    if (contacts.length === 0) {
      continue;
    }

    const payload = JSON.stringify({
      title: "S-Drive · Follow-ups",
      body: buildDigestBody(contacts.map((contact) => contact.person.name)),
      url: "/",
      tag: "s-drive-follow-up",
    });

    let deliveredForProfile = false;

    for (const subscription of subscriptions) {
      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };

      try {
        await sendNotification(pushSubscription, payload);
        pushesSent += 1;
        deliveredForProfile = true;
      } catch (error) {
        const statusCode =
          error instanceof WebPushError ? error.statusCode : undefined;

        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);

          if (!deleteError) {
            staleRemoved += 1;
          }
        } else {
          // Transient/unknown failure: log status only (never the payload).
          console.error(
            `Follow-up push failed for profile ${profile.id} (status ${statusCode ?? "unknown"}).`
          );
        }
      }
    }

    if (deliveredForProfile) {
      profilesNotified += 1;
    }
  }

  return Response.json({ ok: true, profilesNotified, pushesSent, staleRemoved });
}
