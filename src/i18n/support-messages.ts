import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  gameplay: "Partida, carreira ou desempenho",
  account: "Conta e acesso",
  purchase: "Compra ou benefício",
  privacy: "Privacidade e dados",
  report: "Denúncia e segurança",
  invalid:
    "Informe um título de 5 a 120 caracteres e um relato de 20 a 4.000 caracteres, com texto visível. Espaços vazios não formam um pedido.",
  unavailable: "O atendimento automático está indisponível. Use o e-mail principal abaixo.",
  rateLimited: "O limite de pedidos desta hora foi atingido. Aguarde antes de enviar outro pedido.",
  verification: "Confirme o e-mail da sua conta para abrir um pedido de suporte.",
  error:
    "Não foi possível confirmar o pedido. Tente novamente com o mesmo conteúdo para evitar duplicidade.",
  connectionError:
    "A conexão foi interrompida. Tente novamente: o mesmo identificador será usado para evitar pedidos duplicados.",
  checking: "Verificando sua conta…",
  signedOut:
    "Entre na sua conta para acompanhar a identificação do pedido. Você também pode usar os canais de e-mail abaixo.",
  signIn: "Entrar e abrir um pedido",
  deliveredTitle: "Pedido encaminhado ao suporte",
  failedTitle: "Pedido registrado; encaminhamento indisponível",
  queuedTitle: "Pedido registrado na fila de atendimento",
  protocol: "Protocolo:",
  queuedDetail:
    "O encaminhamento será tentado automaticamente. Guarde este protocolo; você não precisa reenviar o pedido.",
  failedDetail:
    "O pedido permanece registrado, mas o serviço de encaminhamento não confirmou a entrega. Entre em contato pelo e-mail principal abaixo e informe este protocolo.",
  deliveredDetail:
    "O suporte recebeu o encaminhamento. O prazo de resposta depende do assunto e do volume de solicitações.",
  another: "Abrir outro pedido",
  category: "Assunto do atendimento",
  subject: "Título",
  subjectPlaceholder: "Descreva o problema em uma frase",
  message: "O que aconteceu?",
  messagePlaceholder:
    "Informe a página, dispositivo, ação e resultado. Para carreira, inclua clube, temporada e rodada.",
  privacyNotice:
    "O relato e o e-mail confirmado da sua conta serão encaminhados ao suporte. Não inclua senhas, códigos, cartão ou documentos pessoais. Para compras, basta o número do pedido.",
  submitting: "Registrando pedido…",
  retry: "Tentar o mesmo pedido novamente",
  submit: "Enviar pedido de suporte",
};
export const SUPPORT_MESSAGES: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    gameplay: "Match, career or performance",
    account: "Account and access",
    purchase: "Purchase or benefit",
    privacy: "Privacy and data",
    report: "Reports and security",
    invalid:
      "Enter a subject of 5–120 characters and a description of 20–4,000 characters with visible text. Blank spaces do not form a request.",
    unavailable: "Automatic support is unavailable. Use the main email below.",
    rateLimited:
      "You have reached this hour's request limit. Wait before submitting another request.",
    verification: "Verify your account email to open a support request.",
    error: "The request could not be confirmed. Retry with the same content to avoid duplicates.",
    connectionError:
      "The connection was interrupted. Retry: the same identifier will be used to avoid duplicate requests.",
    checking: "Checking your account…",
    signedOut:
      "Sign in to associate the request with your account. You can also use the email channels below.",
    signIn: "Sign in and open a request",
    deliveredTitle: "Request forwarded to support",
    failedTitle: "Request recorded; forwarding unavailable",
    queuedTitle: "Request added to the support queue",
    protocol: "Tracking number:",
    queuedDetail:
      "Forwarding will be retried automatically. Keep this tracking number; you do not need to submit the request again.",
    failedDetail:
      "Your request remains recorded, but the forwarding service did not confirm delivery. Contact the main email below and include this tracking number.",
    deliveredDetail:
      "Support received the forwarded request. Response time depends on the topic and request volume.",
    another: "Open another request",
    category: "Support category",
    subject: "Subject",
    subjectPlaceholder: "Describe the issue in one sentence",
    message: "What happened?",
    messagePlaceholder:
      "Include the page, device, action and result. For a career, include the club, season and round.",
    privacyNotice:
      "Your report and verified account email will be forwarded to support. Do not include passwords, codes, card details or personal documents. For purchases, the order number is enough.",
    submitting: "Recording request…",
    retry: "Retry the same request",
    submit: "Send support request",
  },
  es: {
    gameplay: "Partido, carrera o rendimiento",
    account: "Cuenta y acceso",
    purchase: "Compra o beneficio",
    privacy: "Privacidad y datos",
    report: "Denuncias y seguridad",
    invalid:
      "Introduce un título de 5 a 120 caracteres y una descripción de 20 a 4.000 caracteres con texto visible. Los espacios vacíos no forman una solicitud.",
    unavailable:
      "La atención automática no está disponible. Utiliza el correo principal que aparece abajo.",
    rateLimited:
      "Has alcanzado el límite de solicitudes de esta hora. Espera antes de enviar otra.",
    verification: "Confirma el correo de tu cuenta para abrir una solicitud de soporte.",
    error:
      "No se pudo confirmar la solicitud. Vuelve a intentarlo con el mismo contenido para evitar duplicados.",
    connectionError:
      "Se interrumpió la conexión. Vuelve a intentarlo: se utilizará el mismo identificador para evitar solicitudes duplicadas.",
    checking: "Verificando tu cuenta…",
    signedOut:
      "Entra en tu cuenta para vincular la solicitud. También puedes utilizar los correos indicados abajo.",
    signIn: "Entrar y abrir una solicitud",
    deliveredTitle: "Solicitud enviada al soporte",
    failedTitle: "Solicitud registrada; envío no disponible",
    queuedTitle: "Solicitud registrada en la cola de atención",
    protocol: "Número de seguimiento:",
    queuedDetail:
      "El envío se volverá a intentar automáticamente. Guarda este número; no necesitas reenviar la solicitud.",
    failedDetail:
      "La solicitud sigue registrada, pero el servicio no confirmó la entrega. Contacta con el correo principal que aparece abajo e indica este número de seguimiento.",
    deliveredDetail:
      "El soporte recibió la solicitud. El plazo de respuesta depende del asunto y del volumen de solicitudes.",
    another: "Abrir otra solicitud",
    category: "Categoría de atención",
    subject: "Título",
    subjectPlaceholder: "Describe el problema en una frase",
    message: "¿Qué ha ocurrido?",
    messagePlaceholder:
      "Indica la página, dispositivo, acción y resultado. Para una carrera, incluye club, temporada y jornada.",
    privacyNotice:
      "El relato y el correo verificado de tu cuenta se enviarán al soporte. No incluyas contraseñas, códigos, datos de tarjeta ni documentos personales. Para compras, basta con el número del pedido.",
    submitting: "Registrando solicitud…",
    retry: "Reintentar la misma solicitud",
    submit: "Enviar solicitud de soporte",
  },
};
export const supportMessages = (lang: Lang) => featureMessages(lang, SUPPORT_MESSAGES);
