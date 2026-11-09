import { supportContentLocale, supportCopyLanguage } from "./support-locale";

const PT = {
  categoryCareer: "Carreira e progresso",
  categoryPurchase: "Compra e benefícios",
  categoryAccount: "Conta e privacidade",
  categoryBug: "Erro no jogo",
  categorySuggestion: "Sugestão",
  invalidLength: "Descreva o problema com 20 a 4.000 caracteres.",
  rateLimited: "O limite é de três solicitações por hora. Aguarde antes de enviar outra.",
  verificationRequired:
    "Confirme o e-mail da sua conta antes de enviar. Você também pode usar os contatos abaixo.",
  pending: "Sua solicitação está sendo processada. Aguarde 30 segundos antes de tentar novamente.",
  deliveryUnconfirmed:
    "Não foi possível confirmar a entrega. Aguarde 30 segundos e tente novamente, ou use o e-mail abaixo.",
  deliveryError:
    "Não foi possível confirmar a entrega. Preserve a descrição e tente novamente, ou use o e-mail abaixo.",
  checking: "Verificando o atendimento…",
  unavailable:
    "O formulário está temporariamente indisponível. Os contatos oficiais abaixo continuam disponíveis.",
  signIn: "Entre na sua conta",
  signInDescription: "para vincular a solicitação ao seu acesso, ou use o e-mail abaixo.",
  delivered: "Solicitação encaminhada ao suporte. Protocolo:",
  deliveryExplanation:
    "A confirmação é de entrega; o prazo de resposta depende do assunto e do volume de solicitações.",
  another: "Enviar outra solicitação",
  subject: "Assunto",
  message: "Descreva o que aconteceu",
  characterCount: "{count}/4.000 caracteres; mínimo de 20.",
  help: "Informe página, aparelho, navegador e passos para reproduzir. Sua conta e seu e-mail confirmado acompanham a mensagem. Não inclua senha, códigos, cartão ou arquivos de carreira completos.",
  website: "Site",
  sending: "Enviando…",
  submit: "Enviar ao suporte",
  privacyDescription: "Ao enviar, você encaminha estes dados ao atendimento do jogo.",
  privacyPolicy: "Política de privacidade",
};
export type SupportCopyKey = keyof typeof PT;
const EN: Record<SupportCopyKey, string> = {
  categoryCareer: "Career and progress",
  categoryPurchase: "Purchase and benefits",
  categoryAccount: "Account and privacy",
  categoryBug: "Game error",
  categorySuggestion: "Suggestion",
  invalidLength: "Describe the problem using 20 to 4,000 characters.",
  rateLimited: "The limit is three requests per hour. Please wait before submitting another.",
  verificationRequired:
    "Confirm your account email before submitting. You can also use the contacts below.",
  pending: "Your request is being processed. Wait 30 seconds before trying again.",
  deliveryUnconfirmed:
    "Delivery could not be confirmed. Wait 30 seconds and try again, or use the email below.",
  deliveryError:
    "Delivery could not be confirmed. Keep your description and try again, or use the email below.",
  checking: "Checking support availability…",
  unavailable: "The form is temporarily unavailable. The official contacts below remain available.",
  signIn: "Sign in to your account",
  signInDescription: "to link the request to your account, or use the email below.",
  delivered: "Request forwarded to support. Reference:",
  deliveryExplanation:
    "This confirms delivery; the response time depends on the topic and request volume.",
  another: "Send another request",
  subject: "Topic",
  message: "Describe what happened",
  characterCount: "{count}/4,000 characters; minimum 20.",
  help: "Include the page, device, browser and steps to reproduce. Your account and confirmed email accompany the message. Do not include passwords, codes, card details or complete career files.",
  website: "Website",
  sending: "Sending…",
  submit: "Send to support",
  privacyDescription: "By submitting, you send these details to the game’s support team.",
  privacyPolicy: "Privacy policy",
};

/** Imported only by the on-demand support form, never the global bootstrap. */
export function getSupportCopy(lang: string): Readonly<Record<SupportCopyKey, string>> {
  return supportCopyLanguage(lang) === "pt" ? PT : EN;
}

export function formatSupportCharacterCount(lang: string, count: number): string {
  return getSupportCopy(lang).characterCount.replace(
    "{count}",
    new Intl.NumberFormat(supportContentLocale(lang)).format(count),
  );
}
