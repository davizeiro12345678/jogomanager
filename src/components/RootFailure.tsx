import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

function PageFailure({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {children}
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}

export function NotFoundComponent() {
  return (
    <PageFailure
      title="Página não encontrada"
      message="Esta página mudou de endereço ou foi removida."
    />
  );
}

export function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <PageFailure
      title="Não foi possível carregar esta página"
      message="Tente carregar novamente ou volte ao início."
    >
      <button
        type="button"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
        className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Tentar novamente
      </button>
    </PageFailure>
  );
}
