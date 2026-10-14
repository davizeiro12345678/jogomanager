import * as React from "react";
import type { ComponentType } from "react";
import { AccountSecurityEmail, type AccountSecurityEmailProps } from "./account-security";
import { CareerMilestoneEmail, type CareerMilestoneEmailProps } from "./career-milestone";
import { SeasonStartEmail, type SeasonStartEmailProps } from "./season-start";
import { SignupEmail } from "./signup";
import { WelcomeEmail, type WelcomeEmailProps } from "./welcome";

export interface TemplateEntry {
  component: ComponentType<Record<string, unknown>>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

function register<P>(component: ComponentType<P>): ComponentType<Record<string, unknown>> {
  return (props) =>
    React.createElement(component as unknown as ComponentType<Record<string, unknown>>, props);
}

const siteUrl = "https://jogomanager.com";

export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: {
    component: register<WelcomeEmailProps>(WelcomeEmail),
    subject: "Seu clube está pronto: boas-vindas ao Jogo Manager",
    displayName: "Boas-vindas",
    previewData: { name: "Alex", siteUrl },
  },
  "season-start": {
    component: register<SeasonStartEmailProps>(SeasonStartEmail),
    subject: (data) => `${String(data["season"] || "A nova temporada")} começou`,
    displayName: "Início de temporada",
    previewData: { name: "Alex", season: "2026/27", siteUrl },
  },
  "career-milestone": {
    component: register<CareerMilestoneEmailProps>(CareerMilestoneEmail),
    subject: (data) => `Parabéns: ${String(data["milestone"] || "novo marco na carreira")}`,
    displayName: "Marco da carreira",
    previewData: {
      name: "Alex",
      milestone: "Primeira temporada concluída",
      detail: "Seu clube terminou entre os melhores.",
      siteUrl,
    },
  },
  "account-security": {
    component: register<AccountSecurityEmailProps>(AccountSecurityEmail),
    subject: "Aviso de segurança da sua conta",
    displayName: "Segurança da conta",
    previewData: { event: "Novo acesso à conta", eventTime: "14 out 2026, 12:00 UTC", siteUrl },
  },
  signup: {
    component: register<React.ComponentProps<typeof SignupEmail>>(SignupEmail),
    subject: "Confirme seu e-mail no Jogo Manager",
    displayName: "Confirmação de cadastro",
    previewData: {
      siteName: "Jogo Manager",
      siteUrl,
      recipient: "alex@example.com",
      confirmationUrl: `${siteUrl}/confirm?token=preview`,
    },
  },
};
