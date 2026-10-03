import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Accessibility, Type } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useAccessibility } from "./AccessibilityProvider";
type DialogModule = typeof import("./AccessibilityDialog");
let dialogPromise: Promise<DialogModule> | undefined;
const loadAccessibilityDialog = () => {
  dialogPromise ??= import("./AccessibilityDialog").catch((error: unknown) => {
    // An optional chunk can fail during a deployment or a connection outage.
    // Keep the career usable and allow a fresh attempt instead of caching rejection.
    dialogPromise = undefined;
    throw error;
  });
  return dialogPromise;
};

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
export function AccessibilitySettings({
  children,
  className = "preference-launcher",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [DialogView, setDialogView] = useState<DialogModule["default"] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open || DialogView) return;
    let active = true;
    setFailed(false);
    void loadAccessibilityDialog().then(
      (module) => {
        if (active) setDialogView(() => module.default);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [open, DialogView, attempt]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const preload = () => {
    void loadAccessibilityDialog().catch(() => undefined);
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-label={t("access.title")}
        title={t("access.title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (open && event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
      >
        {children ?? (
          <>
            <Accessibility size={19} aria-hidden="true" />
            <span>{t("access.title")}</span>
          </>
        )}
      </button>
      {open && DialogView ? <DialogView trigger={trigger} onClose={close} /> : null}
      {open && !DialogView ? (
        <div
          className="preferences-load-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        >
          <p role={failed ? "alert" : "status"}>
            {t(failed ? "access.loadError" : "access.loading")}
          </p>
          {failed ? (
            <>
              <button
                className="preference-button"
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("common.retry")}
              </button>
              <button
                className="preference-button"
                type="button"
                onClick={() => window.location.reload()}
              >
                {t("common.reload")}
              </button>
            </>
          ) : null}
          <button className="preference-button" type="button" onClick={close}>
            {t("common.close")}
          </button>
        </div>
      ) : null}
    </>
  );
}
