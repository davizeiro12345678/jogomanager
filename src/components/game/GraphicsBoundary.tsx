import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportSilent } from "@/lib/report-silent";

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
    reportSilent("graphics", error, {
      class: "degradation",
      code: "render-boundary",
      boundary: "graphics",
    });
  }
  private retry = () =>
    this.setState(({ generation }) => ({ failed: false, generation: generation + 1 }));
  override render() {
    if (this.state.failed && this.props.fallback)
      return (
        <div className="relative h-full w-full">
          {this.props.fallback}
          <button
            type="button"
            onClick={this.retry}
            className="absolute bottom-4 right-4 z-20 min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg"
            aria-label="Tentar carregar a cena 3D novamente"
          >
            Recarregar cena 3D
          </button>
        </div>
      );
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
            onClick={this.retry}
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
