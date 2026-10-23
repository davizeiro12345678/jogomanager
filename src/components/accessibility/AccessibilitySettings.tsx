import { useT } from "@/i18n/provider";
import { reportSilent } from "@/lib/silent-errors";
import { Accessibility } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
type DialogModule = typeof import("./AccessibilityDialog");
let dialogPromise: Promise<DialogModule> | undefined;
const loadAccessibilityDialog = () => {
  dialogPromise ??= import("./AccessibilityDialog").catch((error: unknown) => {
    // An optional chunk can fail during a deployment or a connection outage.
    // Keep the career usable and allow a fresh attempt instead of caching rejection.
    dialogPromise = undefined;
    reportSilent("accessibility.chunk", error, {
      classification: "degradation",
      feature: "accessibility-dialog",
      phase: "load",
      dedupeKey: "accessibility-dialog-chunk",
    });
    throw error;
  });
  return dialogPromise;
};

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
