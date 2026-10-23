import { useAccessibility } from "@/hooks/useAccessibility";
import { useT } from "@/i18n/provider";
import { Type } from "lucide-react";
import { useId } from "react";

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
        <strong id={`${id}-label`}>{label}</strong>
        {hint && (
          <span id={`${id}-hint`} className="preference-help">
            {hint}
          </span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
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
