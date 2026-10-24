import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/i18n/provider";
import { Settings2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const NarrationPreferences = lazy(() => import("./NarrationPreferences"));

/** Keep the launcher immediate; load voice tools only when the user opens them. */
export function NarrationSettings({
  onOpenChange,
  className = "preference-launcher",
  showLabel = false,
}: {
  onOpenChange?: (open: boolean) => void;
  className?: string;
  showLabel?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={className}
          aria-label={t("match.settings")}
          title={t("match.settings")}
        >
          <Settings2 size={19} aria-hidden="true" />
          {showLabel ? <span>{t("match.settings")}</span> : null}
        </button>
      </DialogTrigger>
      <DialogContent className="preferences-dialog" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("narration.title")}</DialogTitle>
          <DialogDescription>{t("narration.hint")}</DialogDescription>
        </DialogHeader>
        {open && (
          <Suspense fallback={<p role="status">{t("common.loading")}</p>}>
            <NarrationPreferences />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
