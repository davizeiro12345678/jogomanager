import { emailStyles } from "@/lib/email-templates/email-styles";
import { Button, Text } from "react-email";
import { EmailShell } from "./email-shell";

export interface SeasonStartEmailProps {
  name?: string;
  season?: string;
  siteUrl?: string;
}

export function SeasonStartEmail({
  name = "Treinador",
  season = "nova temporada",
  siteUrl = "https://jogomanager.com",
}: SeasonStartEmailProps) {
  return (
    <EmailShell
      preview={`${season}: hora de preparar o elenco.`}
      eyebrow="NOVA TEMPORADA"
      title="A bola vai rolar"
      siteUrl={siteUrl}
    >
      <Text style={emailStyles.paragraph}>
        Olá, {name}. Uma nova temporada está começando e seu próximo desafio já espera por você.
      </Text>
      <Text style={emailStyles.paragraph}>
        Revise o elenco, confira os objetivos e ajuste o plano de jogo antes da estreia.
      </Text>
      <Button href={siteUrl} style={emailStyles.button}>
        Preparar a temporada
      </Button>
      <Text style={emailStyles.note}>Temporada: {season}</Text>
    </EmailShell>
  );
}
export default SeasonStartEmail;
