export const SHARE_URL = "https://jogomanager.com";

export const SHARE_MESSAGE =
  "Conheça o Pro Football Manager 3D: um jogo de futebol manager online e grátis, com partidas em 3D, carreira completa, mercado de transferências e ligas de vários países. Jogue no celular ou computador, sem download.";

export function shareDestinations(url = SHARE_URL, text = SHARE_MESSAGE) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  return [
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      id: "reddit",
      label: "Reddit",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      id: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      id: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
  ] as const;
}

export const COPY_FIRST_DESTINATIONS = [
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
  { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/" },
  { id: "discord", label: "Discord", href: "https://discord.com/app" },
  { id: "messenger", label: "Messenger", href: "https://www.messenger.com/" },
] as const;
