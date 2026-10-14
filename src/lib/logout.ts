import { supabase } from "@/integrations/supabase/client";

/**
 * Unsubscribe the current browser before discarding its authenticated session.
 * Never delete other devices and never let a push outage block logout.
 */
export async function signOutAndCleanDevice() {
  try {
    const push = await import("./firebase-push");
    if (push.hasFirebasePushDeviceToken()) {
      await Promise.race([
        push.disableFirebaseNotifications(),
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
  } catch {
    // Account logout must remain available when FCM or the network fails.
  }
  return supabase.auth.signOut();
}
