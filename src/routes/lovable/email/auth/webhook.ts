import "@tanstack/react-start/server-only";
import * as React from "react";
import { createAuthEmailHandler } from "@lovable.dev/email-js";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import { validateEmailAddress, validateLovableSendUrl } from "@/lib/email-templates/send-email-url";

// Configuration
const SITE_NAME = "Pro Football Manager 3D";
const SENDER_DOMAIN = "notify.jogomanager.com";
const ROOT_DOMAIN = "jogomanager.com";
const FROM_DOMAIN = "jogomanager.com";
const SITE_URL = `https://${ROOT_DOMAIN}`;
const FROM_ADDRESS = validateEmailAddress(`conta@${FROM_DOMAIN}`, "From");
const REPLY_TO_ADDRESS = validateEmailAddress(`contato@${FROM_DOMAIN}`, "Reply-To");

function validateAuthRecipient(data: { email: unknown }): void {
  validateEmailAddress(data.email, "Recipient");
}

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const handler = createAuthEmailHandler({
          apiKey: process.env["LOVABLE_API_KEY"]!,
          from: { name: SITE_NAME, address: FROM_ADDRESS },
          replyTo: { name: "Suporte Pro Football Manager 3D", address: REPLY_TO_ADDRESS },
          senderDomain: SENDER_DOMAIN,
          sendUrl: validateLovableSendUrl(process.env["LOVABLE_SEND_URL"]),
          emails: {
            signup: {
              subject: "Confirme seu e-mail no Pro Football Manager 3D",
              render: (data) => {
                const recipient = validateEmailAddress(data.email, "Recipient");
                return React.createElement(SignupEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  recipient,
                  confirmationUrl: data.url,
                });
              },
            },
            invite: {
              subject: "Você foi convidado para o Pro Football Manager 3D",
              render: (data) => {
                validateAuthRecipient(data);
                return React.createElement(InviteEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  confirmationUrl: data.url,
                });
              },
            },
            magiclink: {
              subject: "Seu link de acesso ao Pro Football Manager 3D",
              render: (data) => {
                validateAuthRecipient(data);
                return React.createElement(MagicLinkEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: data.url,
                });
              },
            },
            recovery: {
              subject: "Redefinir sua senha do Pro Football Manager 3D",
              render: (data) => {
                validateAuthRecipient(data);
                return React.createElement(RecoveryEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: data.url,
                });
              },
            },
            email_change: {
              subject: "Confirme a troca do seu e-mail",
              render: (data) => {
                validateAuthRecipient(data);
                return React.createElement(EmailChangeEmail, {
                  siteName: SITE_NAME,
                  oldEmail: data.old_email ?? "",
                  email: data.email,
                  newEmail: data.new_email ?? "",
                  confirmationUrl: data.url,
                });
              },
            },
            reauthentication: {
              subject: "Seu código de verificação",
              render: (data) => {
                validateAuthRecipient(data);
                return React.createElement(ReauthenticationEmail, { token: data.token ?? "" });
              },
            },
          },
        });
        return handler(request);
      },
    },
  },
});
