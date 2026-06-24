import { cn } from "@moneyroad-app/ui/lib/utils";
import type * as React from "react";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-none bg-muted", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
