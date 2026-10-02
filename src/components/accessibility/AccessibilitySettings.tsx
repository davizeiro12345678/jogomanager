import { useId, type ReactNode } from "react";
import { Accessibility, Check, Type } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/i18n";
import { useAccessibility } from "./AccessibilityProvider";
import { LanguagePicker } from "./LanguagePicker";

export function PreferenceToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="preference-toggle" htmlFor={id}>
      <span>
        <strong>{label}</strong>
        {hint && <span className="preference-help">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function ReadingPreferences() {
  const { t } = useT();
  const { preferences: p, reducedMotion, update, reset } = useAccessibility();
  const id = useId();
  return (
    <div className="reading-preferences">
      <fieldset className="preference-choices">
        <legend className="preference-heading">
          <Type size={18} aria-hidden="true" /> {t("access.text")}
        </legend>
        {(["normal", "large", "xlarge"] as const).map((size) => (
          <label key={size} className={p.textSize === size ? "selected" : ""}>
            <input
              type="radio"
              name={`${id}-text`}
              value={size}
              checked={p.textSize === size}
              onChange={() => update({ textSize: size })}
            />{" "}
            {t(`access.${size}`)}
          </label>
        ))}
      </fieldset>
      <div className="reading-preview" aria-label={t("access.text")}>
        {t("access.preview")}
      </div>
      <PreferenceToggle
        label={t("access.high")}
        checked={p.contrast === "high"}
        onChange={(high) => update({ contrast: high ? "high" : "standard" })}
      />
      <PreferenceToggle
        label={t("access.spacing")}
        hint={t("access.spacingHint")}
        checked={p.readingSpace}
        onChange={(readingSpace) => update({ readingSpace })}
      />
      <PreferenceToggle
        label={t("access.motion")}
        hint={t("access.motionHint")}
        checked={reducedMotion}
        onChange={(reduced) => update({ motion: reduced ? "reduced" : "full" })}
      />
      <button className="preference-button" type="button" onClick={reset}>
        {t("common.reset")}
      </button>
    </div>
  );
}
export function AccessibilitySettings({
  children,
  className = "preference-launcher",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useT();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={className}
          aria-label={t("access.title")}
          title={t("access.title")}
        >
          {children ?? (
            <>
              <Accessibility size={19} aria-hidden="true" />
              <span>{t("access.title")}</span>
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="preferences-dialog" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("access.title")}</DialogTitle>
          <DialogDescription>{t("access.description")}</DialogDescription>
        </DialogHeader>
        <ReadingPreferences />
        <LanguagePicker />
        <p className="preference-help">
          <Check size={15} aria-hidden="true" /> {t("access.updated")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
