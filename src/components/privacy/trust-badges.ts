import { Lock, ShieldCheck } from "lucide-react";

export const TRUST_BADGES = [
  { icon: Lock, label: "Conexão protegida por HTTPS/TLS" },
  { icon: ShieldCheck, label: "Analytics opcional" },
  { icon: ShieldCheck, label: "Telemetria opcional" },
  { icon: ShieldCheck, label: "Exportação JSON" },
  { icon: ShieldCheck, label: "Exclusão de dados" },
  { icon: ShieldCheck, label: "Consentimento revogável" },
  { icon: Lock, label: "Checkout seguro · Powered by Stripe" },
];
