import { Check } from "lucide-react";
import type { RefObject } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/i18n/provider";
import { ReadingPreferences } from "./AccessibilitySettings";
import { LanguagePicker } from "./LanguagePicker";

/** The modal and its language search load only when the preferences open. */
export default function AccessibilityDialog({
  onClose,
  trigger,
}: {
  onClose: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useT();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="preferences-dialog"
        closeLabel={t("common.close")}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
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
