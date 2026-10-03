/** Only local destinations are accepted, including after OAuth callbacks. */
export function safeAuthNext(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    return undefined;
  try {
    const base = "https://auth.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : undefined;
  } catch {
    return undefined;
  }
}

export type AuthMode = "in" | "up" | "reset" | "update" | "magic";

/** Callback URLs may report an expired email link or a failed OAuth code exchange. */
export function authCallbackErrorMessage(errorCode: unknown, errorDescription: unknown): string {
  const code = typeof errorCode === "string" ? errorCode.trim().toLowerCase() : "";
  const description =
    typeof errorDescription === "string" ? errorDescription.trim().toLowerCase() : "";
  const emailLinkError =
    code.startsWith("otp_") ||
    code === "email_not_confirmed" ||
    /(?:e-?mail).*(?:link|code|confirm|expir)|(?:link|code).*(?:expir|invalid)/.test(description);

  return emailLinkError
    ? "O link ou código de e-mail expirou ou não pôde ser validado. Solicite outro e-mail de acesso."
    : "Não foi possível concluir o login com esse provedor. Tente outro método ou entre com e-mail.";
}

export function authErrorMessage(error: unknown, mode: AuthMode): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    invalid_credentials: "E-mail ou senha incorretos. Confira os dados ou recupere sua senha.",
    email_not_confirmed:
      "Confirme seu e-mail antes de entrar. Confira a caixa de entrada e o spam.",
    user_already_exists:
      "Não foi possível concluir o cadastro. Tente entrar ou recuperar sua senha.",
    weak_password: "Escolha uma senha mais forte, com pelo menos 8 caracteres.",
    same_password: "Escolha uma senha diferente da anterior.",
    signup_disabled: "O cadastro está indisponível no momento. Tente novamente mais tarde.",
    over_email_send_rate_limit: "Aguarde alguns minutos antes de solicitar outro e-mail.",
    over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    provider_disabled: "Esta forma de entrada está indisponível. Escolha outro método de acesso.",
    otp_expired: "O código ou link expirou. Solicite um novo e-mail de acesso.",
    otp_disabled: "O acesso por código ou link está indisponível. Escolha outro método de acesso.",
    captcha_failed:
      "O serviço de acesso ainda exige verificação de segurança. Use uma conta vinculada enquanto essa configuração é ajustada.",
  };
  return (
    messages[code] ??
    (mode === "in"
      ? "Não foi possível entrar agora. Confira sua conexão e tente novamente."
      : "Não foi possível concluir a solicitação. Confira sua conexão e tente novamente.")
  );
}
