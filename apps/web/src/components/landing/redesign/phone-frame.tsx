import type { ReactNode } from "react";

import { LogoMark } from "@/components/landing/brand";

type BrandProps = {
  inverted?: boolean;
};

export function LandingBrand({ inverted = false }: BrandProps) {
  return (
    <span className={`brand ${inverted ? "brand--inverted" : ""}`}>
      <span className="brand__mark">
        <LogoMark className="icon" />
      </span>
      <span>머니로드</span>
    </span>
  );
}

type PhoneFrameProps = {
  children: ReactNode;
  label: string;
  className?: string;
};

export function PhoneFrame({
  children,
  label,
  className = "",
}: PhoneFrameProps) {
  return (
    <div aria-label={label} className={`phone-frame ${className}`} role="img">
      <span className="phone-frame__island" />
      <div className="phone-screen">{children}</div>
    </div>
  );
}

export function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <span aria-hidden="true" className="status-bar__icons">
        ● ◒ ▰
      </span>
    </div>
  );
}

const navItems = [
  ["⌂", "홈"],
  ["↗", "시그널"],
  ["▤", "뉴스"],
  ["□", "토론"],
  ["○", "마이"],
] as const;

export function AppNav({ active }: { active: string }) {
  return (
    <div className="app-nav">
      {navItems.map(([symbol, label]) => (
        <span
          className={`app-nav__item ${active === label ? "is-active" : ""}`}
          key={label}
        >
          <b aria-hidden="true">{symbol}</b>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}
