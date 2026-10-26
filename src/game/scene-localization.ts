import {
  CUTSCENES,
  SPEAKER_LABEL,
  type Cutscene,
  type CutsceneLine,
  type Speaker,
} from "@/content/cutscenes";
import type { Lang } from "@/i18n/locale-catalog";

type Translator = (key: string) => string;
/** Localize presentation, keeping the authored object and choice effects intact. */
export function sceneText(
  scene: Cutscene | undefined,
  line: CutsceneLine | undefined,
  lang: Lang,
  t: Translator,
  messageLanguage: (key: string) => Lang,
) {
  const original = line?.text ?? "";
  // A custom scene may reuse a built-in ID. Its personal text must be preserved.
  if (!scene || !line?.id || CUTSCENES[scene.id] !== scene || lang.startsWith("pt"))
    return { text: original, lang: (scene?.language ?? "pt-BR") as Lang };
  const key = `story.${line.id}`;
  const text = t(key);
  return text === key
    ? { text: original, lang: "pt-BR" as Lang }
    : { text, lang: messageLanguage(key) };
}
export function sceneTitle(scene: Cutscene, lang: Lang, t: Translator) {
  if (CUTSCENES[scene.id] !== scene || lang.startsWith("pt")) return scene.title;
  const key = `story.${scene.id}.title`;
  const text = t(key);
  return text === key ? scene.title : text;
}
export function sceneSpeakerLabels(
  lang: Lang,
  t: Translator,
  scene?: Cutscene,
): Record<Speaker, string> {
  const labels = lang.startsWith("pt")
    ? SPEAKER_LABEL
    : (Object.fromEntries(
        Object.entries(SPEAKER_LABEL).map(([speaker, source]) => {
          const key = `scene.speaker.${speaker}`;
          const text = t(key);
          return [speaker, text === key ? source : text];
        }),
      ) as Record<Speaker, string>);
  if (!scene?.speakerNames) return labels;
  return Object.fromEntries(
    Object.entries(labels).map(([speaker, label]) => {
      const name = scene.speakerNames?.[speaker as Speaker];
      return [speaker, typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : label];
    }),
  ) as Record<Speaker, string>;
}
