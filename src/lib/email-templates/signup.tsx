import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Confirme seu e-mail para começar no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Falta só confirmar seu e-mail</Heading>
        <Text style={text}>
          Obrigado por criar sua conta no{" "}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Confirme que este endereço (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) é seu tocando no botão abaixo. Assim seu progresso fica salvo na nuvem.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Confirmar e-mail
        </Button>
        <Text style={footer}>
          Não criou esta conta? Pode ignorar este e-mail com segurança — nada será ativado. Nunca pedimos sua senha por e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default SignupEmail;

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
