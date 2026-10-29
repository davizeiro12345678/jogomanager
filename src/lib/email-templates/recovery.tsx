import * as React from "react";

import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "react-email";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Redefina sua senha do {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Redefinir sua senha</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha da sua conta no {siteName}. Toque no botão
          abaixo para escolher uma nova senha. O link vale por pouco tempo.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Escolher nova senha
        </Button>
        <Text style={footer}>
          Não pediu isso? Ignore este e-mail: sua senha continua a mesma. Nunca pedimos sua senha
          por e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;

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
