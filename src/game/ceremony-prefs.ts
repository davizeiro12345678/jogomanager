// Preferência "não mostrar mais" da cerimônia pré-jogo (manager3d.ceremony).

const CEREMONY_KEY = "manager3d.ceremony";

export function ceremonyEnabled(): boolean {
  try {
    return localStorage.getItem(CEREMONY_KEY) !== "off";
  } catch {
    return true;
  }
}

export function storeCeremony(on: boolean) {
  try {
    localStorage.setItem(CEREMONY_KEY, on ? "on" : "off");
  } catch {
    /* sem armazenamento: vale só para esta sessão */
  }
}
