import { emailStyles } from "@/lib/email-templates/email-styles";
import { Button, Text } from "react-email";
import { EmailShell } from "./email-shell";

export interface CareerMilestoneEmailProps {
  name?: string;
  milestone?: string;
  detail?: string;
  siteUrl?: string;
}

export function CareerMilestoneEmail({
  name = "Treinador",
  milestone = "Uma nova conquista",
  detail = "Seu trabalho está dando resultado.",
  siteUrl = "https://jogomanager.com",
}: CareerMilestoneEmailProps) {
  return (
    <EmailShell
      preview={`${milestone} — parabéns pela campanha.`}
      eyebrow="MARCO DA CARREIRA"
      title="O trabalho aparece em campo"
      siteUrl={siteUrl}
    >
      <Text style={emailStyles.paragraph}>
        Parabéns, {name}. Você alcançou um marco importante na sua carreira.
      </Text>
      <Text style={emailStyles.paragraph}>
        <strong>{milestone}</strong>
        <br />
        {detail}
      </Text>
      <Button href={siteUrl} style={emailStyles.button}>
        Continuar minha carreira
      </Button>
      <Text style={emailStyles.note}>
        Cada temporada tem uma história. Vamos escrever o próximo capítulo.
      </Text>
    </EmailShell>
  );
}
export default CareerMilestoneEmail;
