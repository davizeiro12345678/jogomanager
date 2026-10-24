const PUBLIC_PAYMENT_MESSAGES = {
  unavailable: "Os pagamentos estão temporariamente indisponíveis. Tente novamente mais tarde.",
  rate_limited: "Muitas tentativas de checkout. Aguarde alguns minutos e tente novamente.",
  already_paid: "Esta compra já foi paga. Use o link de e-mail para receber o item.",
  previous_settling:
    "O pagamento anterior ainda está em confirmação. Aguarde a Stripe antes de tentar outra compra.",
  settling:
    "O pagamento está em confirmação. Use a página de retorno da Stripe para acompanhar o status.",
  expired: "O checkout anterior expirou. Volte à loja e abra uma nova tentativa.",
  no_subscription: "Não encontramos uma assinatura ativa para esta conta.",
  invalid_origin: "A origem desta solicitação não está autorizada para checkout.",
  invalid_return: "O endereço de retorno do pagamento não é válido.",
  invalid_email: "Informe um e-mail válido.",
  consent_required: "Confirme que você tem autorização para realizar a compra.",
  invalid_environment: "Ambiente de pagamento inválido.",
  fraud_check_failed:
    "Não foi possível validar esta tentativa de compra com segurança. Aguarde um instante e tente novamente.",
  item_unavailable: "Este item não está disponível.",
} as const;

/** Only fixed application-owned copy can cross the public payment boundary. */
export class PublicPaymentError extends Error {
  constructor(readonly publicCode: keyof typeof PUBLIC_PAYMENT_MESSAGES) {
    super(PUBLIC_PAYMENT_MESSAGES[publicCode]);
    this.name = "PublicPaymentError";
  }
}

export function publicPaymentErrorMessage(error: PublicPaymentError): string {
  return PUBLIC_PAYMENT_MESSAGES[error.publicCode] ?? PUBLIC_PAYMENT_MESSAGES.unavailable;
}

export const PUBLIC_PAYMENTS_UNAVAILABLE = PUBLIC_PAYMENT_MESSAGES.unavailable;
