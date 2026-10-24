import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  isStoreCheckoutAllowed,
  type StoreCheckoutEligibilityInput,
} from "@/lib/store-eligibility";

export function StoreCheckoutAction({
  product,
  children,
}: {
  product: StoreCheckoutEligibilityInput;
  children: ReactNode;
}) {
  if (isStoreCheckoutAllowed(product)) return <>{children}</>;
  return (
    <div className="w-full space-y-2">
      <Button type="button" className="w-full" disabled>
        Venda indisponível
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Para preservar a integridade das competições, este pacote legado não está à venda. As
        compras estão disponíveis apenas para cosméticos.
      </p>
    </div>
  );
}
