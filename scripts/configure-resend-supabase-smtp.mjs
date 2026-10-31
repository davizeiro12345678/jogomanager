// Explicit, secret-safe operator action for Supabase Auth custom SMTP.
// No credentials are ever printed, committed or passed through the browser.
const project = "lguqnwvsfeefxamzeyos";
const sender = process.env.SMTP_FROM || "no-reply@jogomanager.com";
if (!/^[a-z0-9._%+-]+@jogomanager\.com$/i.test(sender))
  throw new Error("Sender must use the verified jogomanager.com domain");

const isApply = process.argv.includes("--apply");
const isVerify = process.argv.includes("--verify");
if (isApply && isVerify) throw new Error("Choose --apply or --verify");
if (!isApply && !isVerify) {
  console.log("DRY RUN: SMTP provider Resend; custom SMTP enabled only with --apply.");
  console.log("Project:", project, "Sender:", sender, "Host: smtp.resend.com; port: 465.");
  process.exit(0);
}
const token = process.env.SUPABASE_ACCESS_TOKEN;
const password = process.env.RESEND_API_KEY;
if (!token || (isApply && !password))
  throw new Error("Provide the management token and (when applying) Resend key securely");
const configUrl = `https://api.supabase.com/v1/projects/${project}/config/auth`;
const authHeaders = { authorization: `Bearer ${token}` };
if (isVerify) {
  const response = await fetch(configUrl, {
    headers: authHeaders,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`SMTP verification failed: HTTP ${response.status}`);
  const config = await response.json();
  if (
    config?.smtp_host !== "smtp.resend.com" ||
    Number(config?.smtp_port) !== 465 ||
    config?.smtp_admin_email !== sender
  )
    throw new Error("SMTP configuration mismatch");
  console.log("SMTP settings match the expected provider and sender.");
  console.log("Inbox receipt, SPF/DKIM and delivery still require separate checks.");
  process.exit(0);
}
const result = await fetch(configUrl, {
  method: "PATCH",
  headers: {
    ...authHeaders,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    // Change only SMTP transport fields; preserve existing signup and email policies.
    smtp_admin_email: sender,
    smtp_host: "smtp.resend.com",
    smtp_port: 465,
    smtp_user: "resend",
    smtp_pass: password,
    smtp_sender_name: "JogoManager",
  }),
  signal: AbortSignal.timeout(15000),
});
if (!result.ok) throw new Error(`SMTP activation failed: HTTP ${result.status} (response hidden)`);
console.log("Auth SMTP setting was accepted by Management API.");
console.log("Still required: signup/reset/OTP inbox tests and delivery monitoring.");
