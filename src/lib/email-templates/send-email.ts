import * as React from "react";
import { render } from "@react-email/render";
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { TEMPLATES } from "./registry";
import { deliverViaResend } from "./resend-transport";
import { enqueueRenderedNotification } from "./queue-email";

// Server-only: reads LOVABLE_API_KEY. Never import from client components.

// Configuration baked in at scaffold time
const SITE_NAME = "Pro Football Manager 3D";
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers. NEVER use the root domain.
const SENDER_DOMAIN = "notify.jogomanager.com";
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// Can be the root domain when display_from_root is enabled — this is cosmetic only.
const FROM_DOMAIN = "jogomanager.com";

export type SendTemplateEmailResult =
  { sent: true } | { sent: false; reason: "recipient_suppressed" | "queued" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>;
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string;
  replyTo?: string;
}

/**
 * Renders a registered template and sends it through Lovable's managed email
 * API. Suppression, retries, and rate limits are enforced by Lovable
 * server-side. A suppressed recipient is an expected outcome
 * ({ sent: false }); any other failure throws — EmailAPIError exposes
 * .code and .status for branching.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const useResend = process.env["TRANSACTIONAL_EMAIL_PROVIDER"] === "resend";
  if (!apiKey && !useResend) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData as never);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  // Delayed messages are opt-in; never queue password resets, OTPs or
  // security mail. The user receives queued != delivered, not a false success.
  const durable = process.env["TRANSACTIONAL_EMAIL_OUTBOX"] === "true";
  if (
    useResend &&
    durable &&
    (templateName === "welcome" ||
      templateName === "season-start" ||
      templateName === "career-milestone")
  ) {
    if (!options.idempotencyKey)
      throw new Error("Durable notifications require an explicit idempotency key");
    const from = process.env["TRANSACTIONAL_EMAIL_FROM"];
    if (!from) throw new Error("TRANSACTIONAL_EMAIL_FROM is required");
    await enqueueRenderedNotification({
      template: templateName,
      recipient,
      from,
      subject,
      html,
      text,
      idempotencyKey: options.idempotencyKey,
    });
    return { sent: false, reason: "queued" };
  }

  if (useResend) {
    const key = process.env["RESEND_API_KEY"];
    const from = process.env["TRANSACTIONAL_EMAIL_FROM"];
    if (!key || !from)
      throw new Error("Configure RESEND_API_KEY and a verified TRANSACTIONAL_EMAIL_FROM.");
    await deliverViaResend({
      key,
      from,
      recipient,
      subject,
      html,
      text,
      idempotencyKey: options.idempotencyKey || crypto.randomUUID(),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });
    return { sent: true };
  }

  try {
    await sendLovableEmail(
      {
        to: recipient,
        from: `"${SITE_NAME}" <contato@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: templateName,
        idempotency_key: options.idempotencyKey || crypto.randomUUID(),
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      },
      { apiKey: apiKey!, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
      return { sent: false, reason: "recipient_suppressed" };
    }
    throw error;
  }

  return { sent: true };
}
