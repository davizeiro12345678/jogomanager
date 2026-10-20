import { emailStyles } from "@/lib/email-templates/email-styles";
import { Button, Text } from "@react-email/components";
import { EmailShell } from "./email-shell";

export interface AccountSecurityEmailProps {
  event?: string;
  eventTime?: string;
  siteUrl?: string;
}

export function AccountSecurityEmail({
  event = "Uma alteração de segurança",
  eventTime = "Agora",
  siteUrl = "https://jogomanager.com",
}: AccountSecurityEmailProps) {
  return (
    <EmailShell
      preview="Aviso de segurança da sua conta Jogo Manager."
      eyebrow="SEGURANÇA DA CONTA"
      title="Uma atividade foi registrada"
      siteUrl={siteUrl}
      footer="Aviso transacional de segurança. Não responda com sua senha ou códigos de acesso."
    >
      <Text style={emailStyles.paragraph}>Registramos esta atividade na sua conta:</Text>
      <Text style={emailStyles.paragraph}>
        <strong>{event}</strong>
        <br />
        {eventTime}
      </Text>
      <Button href={`${siteUrl}/conta`} style={emailStyles.button}>
        Revisar minha conta
      </Button>
      <Text style={emailStyles.note}>
        Se você não reconhece esta atividade, altere sua senha e fale com o suporte. Nunca pediremos
        sua senha por e-mail.
      </Text>
    </EmailShell>
  );
}
export default AccountSecurityEmail;
