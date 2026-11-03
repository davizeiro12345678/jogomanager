import { Link } from "@tanstack/react-router";
import { LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown to signed-out visitors: purchases and account features need a login. */
export function GuestSignInNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Entre na sua conta para comprar</p>
          <p className="text-sm text-muted-foreground">
            Visitantes sem login não podem fazer compras, salvar a carreira na nuvem, usar o chat,
            jogar online nem receber conquistas. Entrar é grátis e leva poucos segundos.
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0">
        <Link to="/auth">
          <LogIn size={16} aria-hidden="true" /> Entrar ou criar conta
        </Link>
      </Button>
    </div>
  );
}

export function GuestSignInButton({ className = "" }: { className?: string }) {
  return (
    <Button asChild className={className} data-testid="guest-signin-to-buy">
      <Link to="/auth">
        <LogIn size={16} aria-hidden="true" /> Entrar para comprar
      </Link>
    </Button>
  );
}
