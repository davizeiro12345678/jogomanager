import { Component, type ErrorInfo, type ReactNode } from "react";
import { I18nContext } from "@/i18n/context";
import { graphicsRecoveryMessages } from "@/i18n/graphics-recovery-messages";

/** A rendering fault can be retried without replacing the live match or save. */
export class GraphicsBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode | ((retry: () => void) => ReactNode) },
  { failed: boolean; generation: number }
> {
  static override contextType = I18nContext;
  declare context: React.ContextType<typeof I18nContext>;

  override state = { failed: false, generation: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown, info: ErrorInfo) {
    void import("@/lib/lovable-error-reporting")
      .then(({ reportLovableError }) =>
        reportLovableError(error, { boundary: "graphics", componentStack: info.componentStack }),
      )
      .catch(() => undefined);
  }
  private retry = () => {
    this.setState(({ generation }) => ({ failed: false, generation: generation + 1 }));
  };

  override render() {
    if (this.state.failed && this.props.fallback) {
      return typeof this.props.fallback === "function"
        ? this.props.fallback(this.retry)
        : this.props.fallback;
    }
    if (this.state.failed)
      return (
        <div
          role="alert"
          className="flex h-full min-h-64 flex-col items-center justify-center gap-3 bg-[#0a1420] px-6 text-center text-white"
        >
          <strong className="text-lg">
            {graphicsRecoveryMessages(this.context.lang).unavailable}
          </strong>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
            onClick={this.retry}
          >
            {this.context.t("common.retry")}
          </button>
        </div>
      );
    return (
      <div key={this.state.generation} className="h-full w-full">
        {this.props.children}
      </div>
    );
  }
}
