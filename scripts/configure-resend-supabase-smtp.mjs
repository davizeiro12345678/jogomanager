// Explicit, secret-safe operator action for Supabase Auth custom SMTP.
// No credentials are ever printed, committed or passed through the browser.
const project = "lguqnwvsfeefxamzeyos";
const sender = process.env.SMTP_FROM || "no-reply@jogomanager.com";
if (!/^[a-z0-9._%+-]+@jogomanager\.com$/i.test(sender))
  throw new Error("Sender must use the verified jogomanager.com domain");

const isApply = process.argv.includes("--apply");
if (!isApply) {
  console.log("DRY RUN: SMTP provider Resend; custom SMTP enabled only with --apply.");
  console.log("Project:", project, "Sender:", sender, "Host: smtp.resend.com; port: 465.");
  process.exit(0);
}
const token = process.env.SUPABASE_ACCESS_TOKEN;
const password = process.env.RESEND_API_KEY;
if (!token || !password) throw new Error("Provide the management token and Resend key securely");
const result = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
  method: "PATCH",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    external_email_enabled: true,
    mailer_secure_email_change_enabled: true,
    mailer_autoconfirm: false,
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
