import * as React from "react";

import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from "react-email";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você foi convidado</Heading>
        <Text style={text}>
          Você recebeu um convite para entrar no{" "}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Toque no botão abaixo para aceitar e criar sua conta.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Aceitar convite
        </Button>
        <Text style={footer}>
          Não esperava este convite? Pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InviteEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#0b3d2c",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#55575d",
  lineHeight: "1.5",
  margin: "0 0 25px",
};
const link = { color: "#0f7a4d", textDecoration: "underline" };
const button = {
  backgroundColor: "#0f7a4d",
  color: "#ffffff",
  fontSize: "14px",
  border: "1px solid #0f7a4d",
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #1ea86a !important; color: #06231a !important; }
  }
  [data-ogsc] .dm-btn { background-color: #1ea86a !important; color: #06231a !important; }
  [data-ogsb] .dm-btn { background-color: #1ea86a !important; color: #06231a !important; }
`;
