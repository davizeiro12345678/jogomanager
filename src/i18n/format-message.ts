import type { Lang } from "./locale-catalog";

export type MessageValues = Readonly<Record<string, string | number>>;

export function resolveMessage(
  key: string,
  sources: readonly { lang: Lang; messages: Readonly<Record<string, string>> | undefined }[],
): { text: string; lang: Lang } | null {
  for (const source of sources) {
    if (source.messages && Object.hasOwn(source.messages, key)) {
      return { text: source.messages[key]!, lang: source.lang };
    }
  }
  return null;
}

export function formatMessage(text: string, values?: MessageValues): string {
  if (!values) return text;
  return text.replace(/\$?\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder,
  );
}
