import * as React from "react";

import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from "react-email";

interface EmailChangeEmailProps {
  siteName: string;
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Confirme a troca de e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirme a troca de e-mail</Heading>
        <Text style={text}>
          Você pediu para trocar o e-mail da sua conta no {siteName} de{" "}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{" "}
          para{" "}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>Toque no botão abaixo para confirmar:</Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Confirmar troca
        </Button>
        <Text style={footer}>
          Não pediu esta troca? Troque sua senha agora para proteger sua conta.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;

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
