import { resolveLang } from "@/i18n/locale-catalog";
/** Match actual language codes, avoiding Norwegian matching Northern Sotho. */
export function voicesForLanguage(
  voices: readonly SpeechSynthesisVoice[],
  tag: string,
): SpeechSynthesisVoice[] {
  const wanted = resolveLang(tag);
  const base = tag.toLowerCase().replaceAll("_", "-").split("-")[0];
  return voices
    .filter((voice) => {
      const language = resolveLang(voice.lang);
      if (wanted === "zh-CN" || wanted === "zh-TW") return language === wanted;
      return (
        voice.lang.toLowerCase().replaceAll("_", "-").split("-")[0] === base ||
        (wanted !== undefined && language === wanted)
      );
    })
    .sort((a, b) => {
      const exact = (voice: SpeechSynthesisVoice) =>
        voice.lang.toLowerCase().replaceAll("_", "-") === tag.toLowerCase().replaceAll("_", "-")
          ? 2
          : voice.default
            ? 1
            : 0;
      return exact(b) - exact(a);
    });
}
