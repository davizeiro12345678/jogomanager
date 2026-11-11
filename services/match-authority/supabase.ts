/** Server-only Supabase REST access for the isolated match authority Worker.
 * Never call from the browser and never put service credentials into a URL.
 */
export interface AuthorityDatabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const ROOM_ID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

function endpoint(env: AuthorityDatabaseEnv, path: string, params?: URLSearchParams): string {
  const base = new URL(env.SUPABASE_URL);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    !base.hostname.endsWith(".supabase.co")
  )
    throw new Error("match authority Supabase endpoint is not trusted");
  const url = new URL(path, base);
  if (params) url.search = params.toString();
  return url.toString();
}

async function request(
  env: AuthorityDatabaseEnv,
  path: string,
  method: "GET" | "POST",
  params?: URLSearchParams,
  payload?: object,
): Promise<unknown> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.length < 20)
    throw new Error("match authority service role is not configured");
  const response = await fetch(endpoint(env, path, params), {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`match authority database request failed: ${response.status}`);
  return (await response.json()) as unknown;
}

function singleResult(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) &&
    value.length === 1 &&
    value[0] !== null &&
    typeof value[0] === "object" &&
    !Array.isArray(value[0])
    ? (value[0] as Record<string, unknown>)
    : null;
}

export interface PrivateMatchDescriptor {
  roomId: string;
  homeId: string;
  awayId: string;
  homeClub: string;
  awayClub: string;
  seed: string;
  revision: 1 | 2;
}

export async function loadPrivateLiveRoom(
  env: AuthorityDatabaseEnv,
  roomId: string,
): Promise<PrivateMatchDescriptor | null> {
  if (!ROOM_ID.test(roomId)) return null;
  const params = new URLSearchParams({
    select: "id,host_id,guest_id,host_club,guest_club,status,server_seeded,contact_physics_revision",
    id: `eq.${roomId}`,
    limit: "1",
  });
  const room = singleResult(await request(env, "/rest/v1/match_rooms", "GET", params));
  if (
    !room ||
    room["id"] !== roomId ||
    room["status"] !== "live" ||
    room["server_seeded"] !== true ||
    typeof room["host_id"] !== "string" ||
    typeof room["guest_id"] !== "string" ||
    !ROOM_ID.test(room["host_id"]) ||
    !ROOM_ID.test(room["guest_id"]) ||
    room["host_id"] === room["guest_id"] ||
    typeof room["host_club"] !== "string" ||
    typeof room["guest_club"] !== "string" ||
    ![1, 2].includes(room["contact_physics_revision"] as number)
  )
    return null;
  const secrets = singleResult(
    await request(
      env,
      "/rest/v1/match_room_secrets",
      "GET",
      new URLSearchParams({ select: "seed", room_id: `eq.${roomId}`, limit: "1" }),
    ),
  );
  if (
    !secrets ||
    typeof secrets["seed"] !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(secrets["seed"])
  )
    return null;
  return {
    roomId,
    homeId: room["host_id"],
    awayId: room["guest_id"],
    homeClub: room["host_club"],
    awayClub: room["guest_club"],
    seed: secrets["seed"],
    revision: room["contact_physics_revision"] as 1 | 2,
  };
}

export async function allocateQueuePair(env: AuthorityDatabaseEnv): Promise<unknown> {
  return request(env, "/rest/v1/rpc/match_queue_allocate", "POST", undefined, {});
}

export interface SettlementInput {
  p_room: string;
  p_receipt_id: string;
  p_hash: string;
  p_signature: string;
  p_simulation_version: "contact-1" | "contact-2";
  p_closure_reason: "completed" | "forfeit" | "abandoned" | "cancelled";
  p_home_goals: number;
  p_away_goals: number;
  p_minute: number;
}

export async function settleAuthorityReceipt(
  env: AuthorityDatabaseEnv,
  data: SettlementInput,
): Promise<unknown> {
  return request(env, "/rest/v1/rpc/settle_authoritative_match", "POST", undefined, data);
}
