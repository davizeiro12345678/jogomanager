import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, emailStyles } from "./email-shell";

export interface WelcomeEmailProps {
  name?: string;
  siteUrl?: string;
}

export function WelcomeEmail({
  name = "Treinador",
  siteUrl = "https://jogomanager.com",
}: WelcomeEmailProps) {
  return (
    <EmailShell
      preview={`${name}, seu próximo grande time começa aqui.`}
      eyebrow="SEU CLUBE ESTÁ PRONTO"
      title={`Boas-vindas, ${name}!`}
      siteUrl={siteUrl}
      footer="Você recebeu esta mensagem porque criou uma conta no Jogo Manager."
    >
      <Text style={emailStyles.paragraph}>
        A partir de agora, cada escalação, contratação e decisão tática ajuda a escrever a história
        do seu clube.
      </Text>
      <Text style={emailStyles.paragraph}>
        Monte seu elenco, escolha como quer jogar e leve o time até o topo. Seu progresso fica salvo
        na sua conta.
      </Text>
      <Button href={siteUrl} style={emailStyles.button}>
        Entrar no meu clube
      </Button>
      <Text style={emailStyles.note}>
        Dica de treinador: comece definindo sua formação e conhecendo o elenco.
      </Text>
    </EmailShell>
  );
}
export default WelcomeEmail;
