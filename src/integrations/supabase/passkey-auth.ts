export function supportsPasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.get === "function" &&
    typeof navigator.credentials?.create === "function"
  );
}

export function passkeyErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || code === "ERROR_CEREMONY_ABORTED")
    return "A solicitação da chave de acesso foi cancelada ou expirou. Tente novamente ou use outra forma de entrada.";
  if (code === "captcha_failed")
    return "O serviço de acesso ainda exige verificação de segurança. Use uma conta vinculada enquanto essa configuração é ajustada.";
  if (code === "passkey_disabled")
    return "As chaves de acesso estão indisponíveis no momento. Use outra forma de entrada.";
  if (name === "SecurityError" || code === "ERROR_INVALID_RP_ID")
    return "Esta chave de acesso deve ser usada no endereço do jogo onde foi cadastrada.";
  return "Não foi possível usar a chave de acesso. Tente novamente ou entre com e-mail ou uma conta vinculada.";
}
