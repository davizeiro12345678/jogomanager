import * as React from "react";

import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirme que é você</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          O código expira em poucos minutos. Não pediu? Ignore este e-mail. Nunca compartilhe este código com ninguém.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ReauthenticationEmail;

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
const codeStyle = {
  fontFamily: "Courier, monospace",
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#000000",
  margin: "0 0 30px",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
