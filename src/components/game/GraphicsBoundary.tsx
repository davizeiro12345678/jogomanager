import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/** A rendering fault can be retried without replacing the live match or save. */
export class GraphicsBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean; generation: number }
> {
  override state = { failed: false, generation: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown, info: ErrorInfo) {
    reportLovableError(error, { boundary: "graphics", componentStack: info.componentStack });
  }
  override render() {
    if (this.state.failed && this.props.fallback) return this.props.fallback;
    if (this.state.failed)
      return (
        <div
          role="alert"
          className="flex h-full min-h-64 flex-col items-center justify-center gap-3 bg-[#0a1420] px-6 text-center text-white"
        >
          <strong className="text-lg">O estádio 3D não carregou</strong>
          <p className="max-w-sm text-sm text-white/70">
            Tente carregar os gráficos novamente. O andamento da partida continua preservado.
          </p>
          <button
            className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
            onClick={() =>
              this.setState(({ generation }) => ({ failed: false, generation: generation + 1 }))
            }
          >
            Tentar novamente
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
