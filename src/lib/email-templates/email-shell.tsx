import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface EmailShellProps {
  preview: string;
  eyebrow?: string;
  title: string;
  siteUrl?: string;
  footer?: string;
  children: React.ReactNode;
}

export function EmailShell({
  preview,
  eyebrow,
  title,
  siteUrl = "https://jogomanager.com",
  footer,
  children,
}: EmailShellProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brand}>JOGO MANAGER</Text>
            <Text style={brandCaption}>FUTEBOL, DO SEU JEITO</Text>
          </Section>
          <Section style={content}>
            {eyebrow ? <Text style={eyebrowStyle}>{eyebrow}</Text> : null}
            <Heading style={heading}>{title}</Heading>
            {children}
          </Section>
          <Section style={footerSection}>
            <Text style={footerText}>
              {footer || "Esta é uma mensagem automática da sua conta Jogo Manager."}
            </Text>
            <Text style={footerText}>
              Precisa de ajuda?{" "}
              <Link href={`${siteUrl}/suporte`} style={footerLink}>
                Fale com o suporte
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  paragraph: { color: "#34453c", fontSize: "15px", lineHeight: "1.65", margin: "0 0 18px" },
  button: {
    backgroundColor: "#087443",
    borderRadius: "10px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "1",
    padding: "15px 22px",
    textDecoration: "none",
  },
  note: { color: "#526259", fontSize: "13px", lineHeight: "1.6", margin: "18px 0 0" },
};

const body = {
  backgroundColor: "#f1f5f2",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  margin: "0",
  padding: "28px 12px",
};
const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #dce8df",
  borderRadius: "16px",
  margin: "0 auto",
  maxWidth: "600px",
  overflow: "hidden" as const,
};
const brandBar = { backgroundColor: "#0b2c20", padding: "22px 32px" };
const brand = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "800" as const,
  letterSpacing: "2px",
  margin: "0",
};
const brandCaption = {
  color: "#a9d8bc",
  fontSize: "10px",
  letterSpacing: "2px",
  margin: "6px 0 0",
};
const content = { padding: "38px 32px 34px" };
const eyebrowStyle = {
  color: "#087443",
  fontSize: "11px",
  fontWeight: "700" as const,
  letterSpacing: "1.5px",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};
const heading = {
  color: "#112c20",
  fontSize: "30px",
  fontWeight: "750" as const,
  letterSpacing: "-0.8px",
  lineHeight: "1.15",
  margin: "0 0 22px",
};
const footerSection = {
  backgroundColor: "#f7faf8",
  borderTop: "1px solid #e5eee8",
  padding: "18px 32px 22px",
};
const footerText = { color: "#647269", fontSize: "12px", lineHeight: "1.55", margin: "4px 0" };
const footerLink = { color: "#087443", textDecoration: "underline" };
