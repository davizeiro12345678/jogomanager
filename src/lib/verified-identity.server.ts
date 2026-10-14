import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Revalidate ownership with Supabase Auth, not a client-supplied email or
 * mutable user_metadata. A JWT containing an email does not prove that its
 * owner controls that mailbox until auth.users.email_confirmed_at is set.
 */
export async function verifiedAccount(
  supabase: SupabaseClient<Database>,
  expectedUserId: string,
) {
  const bearer = getRequest()?.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return null;
  const token = bearer.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  const user = data.user;
  if (
    error ||
    !user ||
    user.id !== expectedUserId ||
    !user.email ||
    !user.email_confirmed_at
  ) {
    return null;
  }
  return user;
}
