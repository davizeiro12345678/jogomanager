import { useMemo, useState, useId } from "react";
import { Languages, Search } from "lucide-react";
import { LANGS, LANG_NAMES, useT, type Lang } from "@/i18n/provider";
import { languageSearchText, RTL_LANGS } from "@/i18n/locale-catalog";

export function LanguagePicker() {
  const { lang, setLang, t } = useT();
  const id = useId();
  const [query, setQuery] = useState("");
  const normal = query.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
  const filtered = useMemo(
    () => LANGS.filter((l) => languageSearchText(l, lang).includes(normal)),
    [normal, lang],
  );
  return (
    <div className="language-picker">
      <label className="preference-heading" htmlFor={id}>
        <Languages size={18} aria-hidden="true" /> {t("shell.language")}{" "}
        <span className="preference-badge">{LANGS.length}</span>
      </label>
      <div className="language-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("language.search")}
          aria-describedby={`${id}-hint`}
          placeholder={t("common.search")}
          autoComplete="off"
        />
      </div>
      <p id={`${id}-hint`} className="preference-help">
        {t("language.hint")}
      </p>
      {filtered.length ? (
        <select
          id={id}
          size={Math.min(6, Math.max(2, filtered.length))}
          value={filtered.includes(lang) ? lang : ""}
          onChange={(e) => {
            setLang(e.target.value as Lang);
            setQuery("");
          }}
          aria-label={t("shell.language")}
          className="language-options"
        >
          {!filtered.includes(lang) && (
            <option value="" disabled>
              {t("language.selected")}: {LANG_NAMES[lang]}
            </option>
          )}
          {filtered.map((l) => (
            <option key={l} value={l} lang={l} dir={RTL_LANGS.has(l) ? "rtl" : "ltr"}>
              {LANG_NAMES[l]} · {l}
            </option>
          ))}
        </select>
      ) : (
        <p role="status" className="preference-help">
          {t("common.empty")}
        </p>
      )}
      <p className="preference-help" aria-live="polite">
        {filtered.length} {t("language.count")} · {t("language.selected")}:{" "}
        <bdi lang={lang}>{LANG_NAMES[lang]}</bdi>
      </p>
      <p className="preference-help">{t("language.coverage")}</p>
    </div>
  );
}
