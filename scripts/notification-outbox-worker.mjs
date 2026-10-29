// Private durable notification consumer. The database owns leases and retries.
// Run only on an authorized server, never from the browser.
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function traceparent(trace) {
  const id = /^[a-f0-9]{32}$/.test(trace || "") ? trace : randomBytes(16).toString("hex");
  return `00-${id}-${randomBytes(8).toString("hex")}-01`;
}
export async function processBatch({ rpc, deliver, log = () => {} }) {
  await rpc("jm_reap_notifications", {}, traceparent());
  const items = await rpc("jm_claim_notifications", { p_limit: 5 }, traceparent());
  if (!Array.isArray(items)) throw new Error("Invalid queue response");
  const summary = { claimed: items.length, delivered: 0, deferred: 0, dead: 0 };
  for (const item of items) {
    const trace = traceparent(item.trace_id);
    let success = false;
    let terminal = false;
    let errorText = null;
    try {
      await deliver(item, trace);
      success = true;
    } catch (error) {
      terminal = error?.permanent === true;
      errorText = error instanceof Error ? error.message.slice(0, 100) : "provider failure";
    }
    const ack = await rpc(
      "jm_ack_notification",
      {
        p_id: item.id, p_lease_token: item.lease_token,
        p_success: success, p_terminal: terminal, p_error: errorText,
      },
      trace,
    );
    if (ack !== true) throw new Error("Lease acknowledgement rejected");
    if (success) summary.delivered++;
    else if (terminal) summary.dead++;
    else summary.deferred++;
    log({ event: "outbox_attempt", trace_id: trace.slice(3, 35), success, terminal });
  }
  return summary;
}
export function createTransport({ baseUrl, authToken, emailToken, fetcher = fetch }) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co"))
    throw new Error("Invalid project origin");
  return {
    rpc: async (name, body, trace) => {
      const result = await fetcher(new URL(`/rest/v1/rpc/${name}`, base), {
        method: "POST", headers: {
          apikey: authToken, authorization: `Bearer ${authToken}`,
          "content-type": "application/json", traceparent: trace,
        },
        body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) throw new Error(`Queue RPC ${name} HTTP ${result.status}`);
      return result.json();
    },
    deliver: async (job, trace) => {
      if (!/^[a-f0-9]{64}$/.test(job.dedupe_key))
        throw Object.assign(new Error("Invalid deduplication key"), { permanent: true });
      const p = job.payload;
      if (!p || ![p.to, p.from, p.subject, p.html, p.text].every(
        (s) => typeof s === "string" && s.length > 0,
      )) throw Object.assign(new Error("Invalid notification payload"), { permanent: true });
      const result = await fetcher("https://api.resend.com/emails", {
        method: "POST", headers: {
          authorization: `Bearer ${emailToken}`, "content-type": "application/json",
          "Idempotency-Key": job.dedupe_key, traceparent: trace,
        },
        body: JSON.stringify({
          from: p.from, to: [p.to], subject: p.subject,
          html: p.html, text: p.text,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!result.ok) {
        const err = new Error(`Resend HTTP ${result.status}`);
        err.permanent = [400, 401, 403, 404, 409, 422].includes(result.status);
        throw err;
      }
    },
  };
}
async function main() {
  if (!process.argv.includes("--once")) throw new Error("Only --once supported");
  const required = (key) => {
    if (!process.env[key]) throw new Error(`Missing private setting ${key}`);
    return process.env[key];
  };
  const transport = createTransport({
    baseUrl: required("SUPABASE_URL"),
    authToken: required("SUPABASE_SERVICE_ROLE_KEY"),
    emailToken: required("RESEND_API_KEY"),
  });
  console.log(JSON.stringify(await processBatch({
    ...transport,
    log: (event) => console.log(JSON.stringify(event)),
  })));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : "Notification worker error");
    process.exitCode = 1;
  });
