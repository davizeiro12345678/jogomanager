import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

type EmailTemplatePreview = (props: Record<string, string>) => React.ReactElement;

const toPreviewComponent =
  <Props extends object>(component: React.ComponentType<Props>): EmailTemplatePreview =>
  (props) =>
    React.createElement(component, props as Props);

const EMAIL_TEMPLATES: Record<string, () => Promise<EmailTemplatePreview>> = {
  signup: () =>
    import("@/lib/email-templates/signup").then((m) => toPreviewComponent(m.SignupEmail)),
  invite: () =>
    import("@/lib/email-templates/invite").then((m) => toPreviewComponent(m.InviteEmail)),
  magiclink: () =>
    import("@/lib/email-templates/magic-link").then((m) => toPreviewComponent(m.MagicLinkEmail)),
  recovery: () =>
    import("@/lib/email-templates/recovery").then((m) => toPreviewComponent(m.RecoveryEmail)),
  email_change: () =>
    import("@/lib/email-templates/email-change").then((m) =>
      toPreviewComponent(m.EmailChangeEmail),
    ),
  reauthentication: () =>
    import("@/lib/email-templates/reauthentication").then((m) =>
      toPreviewComponent(m.ReauthenticationEmail),
    ),
};

// Configuration
const SITE_NAME = "Pro Football Manager 3D";
const ROOT_DOMAIN = "jogomanager.com";

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://stadium-stewards.lovable.app";
const SAMPLE_EMAIL = "user@example.test";
const SAMPLE_DATA: Record<string, Record<string, string>> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: "123456",
  },
};

export const Route = createFileRoute("/lovable/email/auth/preview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];

        if (!apiKey) {
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Verify the caller is authorized with LOVABLE_API_KEY
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }

        if (
          !body ||
          typeof body !== "object" ||
          !("type" in body) ||
          typeof body.type !== "string"
        ) {
          return Response.json({ error: "Invalid email type" }, { status: 400 });
        }

        const type = body.type;
        const loadTemplate = Object.hasOwn(EMAIL_TEMPLATES, type)
          ? EMAIL_TEMPLATES[type]
          : undefined;

        if (!loadTemplate) {
          return Response.json({ error: `Unknown email type: ${type}` }, { status: 400 });
        }

        // Unauthorized or malformed requests never evaluate the React Email
        // renderer or template package during edge Worker initialization.
        const [{ render }, EmailTemplate] = await Promise.all([
          import("@react-email/render"),
          loadTemplate(),
        ]);
        const sampleData = SAMPLE_DATA[type] || {};
        const html = await render(React.createElement(EmailTemplate, sampleData));

        return new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
