import { savePushSubscription, deletePushSubscription } from "@/app/push-actions";

export type PushActionResult = { ok: boolean; error?: string };

const SERVICE_WORKER_URL = "/sw.js";

function isBrowser() {
  return typeof window !== "undefined";
}

/** True when the browser supports service workers, Push, and Notifications. */
export function isPushSupported(): boolean {
  return (
    isBrowser() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current Notification permission, or "default" when unavailable (SSR / unsupported). */
export function getPushPermission(): NotificationPermission {
  if (!isBrowser() || !("Notification" in window)) {
    return "default";
  }

  return Notification.permission;
}

/** Whether this device already holds an active push subscription. */
export async function isPushEnabled(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    return false;
  }

  const subscription = await registration.pushManager.getSubscription();

  return Boolean(subscription);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  // Back the view with a concrete ArrayBuffer so it satisfies BufferSource.
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Registers the service worker, requests Notification permission, subscribes to
 * Web Push, and persists the subscription for the given profile.
 */
export async function enablePush(profileId: string): Promise<PushActionResult> {
  if (!isPushSupported()) {
    return {
      ok: false,
      error: "Push notifications aren't supported on this device.",
    };
  }

  if (!profileId) {
    return { ok: false, error: "Choose a profile before enabling reminders." };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return { ok: false, error: "Push notifications are not configured." };
  }

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      return {
        ok: false,
        error:
          permission === "denied"
            ? "Notifications are blocked. Enable them in your browser settings."
            : "Notification permission was not granted.",
      };
    }

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: "Could not read the push subscription." };
    }

    const result = await savePushSubscription({
      profileId,
      endpoint,
      p256dh,
      auth,
      userAgent: navigator.userAgent,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not enable reminders.",
    };
  }
}

/** Unsubscribes locally and removes the stored subscription row. */
export async function disablePush(): Promise<PushActionResult> {
  if (!isPushSupported()) {
    return { ok: true };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (!subscription) {
      return { ok: true };
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const result = await deletePushSubscription(endpoint);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not turn off reminders.",
    };
  }
}
