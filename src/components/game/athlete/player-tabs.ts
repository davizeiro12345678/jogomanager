export type Tab =
  | "semana"
  | "calendario"
  | "saude"
  | "atributos"
  | "selecao"
  | "contrato"
  | "noticias"
  | "historico";

export const TABS: { id: Tab; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "calendario", label: "Calendário" },
  { id: "saude", label: "Saúde" },
  { id: "atributos", label: "Atributos" },
  { id: "selecao", label: "Seleção" },
  { id: "contrato", label: "Contrato e propostas" },
  { id: "noticias", label: "Notícias" },
  { id: "historico", label: "Histórico" },
];
