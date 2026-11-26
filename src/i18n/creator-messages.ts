import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Responsável e origem do projeto",
  owner: "Responsável",
  origin: "Local de criação",
  address: "Endereço informado pelo responsável",
  cpf: "CPF do responsável",
  onlineSupport: "Para atendimento, use os canais de suporte online indicados nesta página.",
  supportEyebrow: "Atendimento do treinador",
  supportTitle: "Abra um pedido de suporte",
  supportDescription:
    "Registre o problema com um protocolo e encaminhamento automático. Escolha a categoria para ajudar a equipe a encontrar o contexto da sua solicitação.",
  supportLoading: "Carregando atendimento…",
  supportStart: "Começar atendimento",
  updatedDate: "8 de novembro de 2026",
};
export const CREATOR_MESSAGES: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    title: "Project creator and origin",
    owner: "Responsible person",
    origin: "Created in",
    address: "Address provided by the responsible person",
    cpf: "Responsible person's Brazilian tax ID (CPF)",
    onlineSupport: "For assistance, use the online support channels listed on this page.",
    supportEyebrow: "Manager support",
    supportTitle: "Open a support request",
    supportDescription:
      "Report the issue with a tracking number and automatic forwarding. Choose a category to help the team understand your request.",
    supportLoading: "Loading support…",
    supportStart: "Start a support request",
    updatedDate: "November 8, 2026",
  },
  es: {
    title: "Responsable y origen del proyecto",
    owner: "Responsable",
    origin: "Lugar de creación",
    address: "Dirección facilitada por el responsable",
    cpf: "Identificación fiscal brasileña (CPF) del responsable",
    onlineSupport:
      "Para recibir ayuda, utiliza los canales de soporte en línea indicados en esta página.",
    supportEyebrow: "Atención al entrenador",
    supportTitle: "Abre una solicitud de soporte",
    supportDescription:
      "Registra el problema con un número de seguimiento y envío automático. Elige la categoría para ayudar al equipo a comprender tu solicitud.",
    supportLoading: "Cargando soporte…",
    supportStart: "Iniciar una solicitud",
    updatedDate: "8 de noviembre de 2026",
  },
};
export const creatorMessages = (lang: Lang) => featureMessages(lang, CREATOR_MESSAGES);
