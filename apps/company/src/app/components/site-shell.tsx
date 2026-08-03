import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-root">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
