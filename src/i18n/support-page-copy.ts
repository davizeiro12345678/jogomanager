import { SUPPORT_UPDATED_AT } from "@/content/creator";
import { supportContentLocale, supportCopyLanguage } from "./support-locale";

const PT = {
  contactIntro:
    "A equipe do Pro Football Manager 3D responde por estes canais. Escolha o assunto para chegar mais rápido a quem resolve. Página atualizada em",
  supportTitle: "Enviar solicitação ao suporte",
  supportDescription:
    "Descreva o problema para encaminhá-lo ao atendimento e receber um protocolo de entrega. Os contatos por e-mail continuam disponíveis para quem não consegue entrar na conta.",
  open: "Abrir formulário de suporte",
  opening: "Abrindo formulário…",
  loadError: "Não foi possível abrir o formulário. Tente novamente ou utilize os contatos abaixo.",
  creatorLabel: "Criador e desenvolvedor",
  creatorCpfLabel: "CPF do criador",
  cpfLabel: "CPF",
  origin: "O projeto foi criado em Vitória, Espírito Santo, Brasil.",
};
export type SupportPageCopyKey = keyof typeof PT;
const EN: Record<SupportPageCopyKey, string> = {
  contactIntro:
    "The Pro Football Manager 3D team responds through these channels. Choose a topic to reach the right support channel. Page updated on",
  supportTitle: "Send a support request",
  supportDescription:
    "Describe the problem to send it to support and receive a delivery reference. Email contacts remain available if you cannot sign in.",
  open: "Open support form",
  opening: "Opening form…",
  loadError: "The form could not be opened. Try again or use the contacts below.",
  creatorLabel: "Creator and developer",
  creatorCpfLabel: "Creator’s CPF (Brazilian tax ID)",
  cpfLabel: "CPF (Brazilian tax ID)",
  origin: "The project was created in Vitória, Espírito Santo, Brazil.",
};

/** Small public-page copy; the full form dictionary stays in its lazy chunk. */
export function getSupportPageCopy(lang: string): Readonly<Record<SupportPageCopyKey, string>> {
  return supportCopyLanguage(lang) === "pt" ? PT : EN;
}

export function formatSupportUpdatedDate(lang: string): string {
  return new Intl.DateTimeFormat(supportContentLocale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${SUPPORT_UPDATED_AT}T00:00:00Z`));
}
