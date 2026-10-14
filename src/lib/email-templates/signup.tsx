import * as React from "react";
import { Button, Link, Text } from "@react-email/components";
import { EmailShell, emailStyles } from "./email-shell";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export function SignupEmail({
  siteName = "Jogo Manager",
  siteUrl = "https://jogomanager.com",
  recipient = "treinador@example.com",
  confirmationUrl = "https://jogomanager.com/confirm",
}: SignupEmailProps) {
  return (
    <EmailShell
      preview={`Confirme seu e-mail para começar no ${siteName}.`}
      eyebrow="QUASE LÁ"
      title="Confirme seu e-mail"
      siteUrl={siteUrl}
      footer="Você recebeu esta mensagem porque iniciou a criação de uma conta."
    >
      <Text style={emailStyles.paragraph}>
        Obrigado por criar sua conta no <strong>{siteName}</strong>. Confirme que este endereço
        pertence a você:
      </Text>
      <Text style={emailStyles.paragraph}>
        <Link href={`mailto:${recipient}`} style={{ color: "#087443" }}>
          {recipient}
        </Link>
      </Text>
      <Button href={confirmationUrl} style={emailStyles.button}>
        Confirmar e-mail
      </Button>
      <Text style={emailStyles.note}>
        Não criou esta conta? Ignore esta mensagem com segurança. Nunca pedimos sua senha por
        e-mail.
      </Text>
    </EmailShell>
  );
}

export default SignupEmail;
