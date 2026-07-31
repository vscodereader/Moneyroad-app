import type { ReactNode } from "react";
import { Reveal } from "./reveal";

interface PageHeroProps {
  description: ReactNode;
  eyebrow: string;
  title: ReactNode;
  variant?: "company" | "service" | "faq" | "notice" | "disclosure" | "contact";
}

const serviceBarKeys = [
  "bar-1",
  "bar-2",
  "bar-3",
  "bar-4",
  "bar-5",
  "bar-6",
  "bar-7",
] as const;
const serviceLineKeys = [
  "line-1",
  "line-2",
  "line-3",
  "line-4",
  "line-5",
] as const;
const defaultDotKeys = [
  "dot-1",
  "dot-2",
  "dot-3",
  "dot-4",
  "dot-5",
  "dot-6",
] as const;

function renderHeroArtwork(variant: PageHeroProps["variant"]) {
  if (variant === "service") {
    return (
      <div className="service-chart-window">
        <div className="service-chart-path">
          <div className="service-chart-bars">
            {serviceBarKeys.map((key) => (
              <span key={key} />
            ))}
          </div>
          <div className="service-chart-line">
            {serviceLineKeys.map((key) => (
              <span key={key} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "company") {
    return (
      <div className="company-gate-mark">
        <span className="company-gate-top" />
        <span className="company-gate-left" />
        <span className="company-gate-right" />
        <span className="company-road-left" />
        <span className="company-road-right" />
        <span className="company-road-center" />
        <span className="company-gate-point" />
      </div>
    );
  }

  if (variant === "contact") {
    return (
      <div className="contact-headset-mark">
        <span className="contact-agent-head" />
        <span className="contact-agent-shoulders" />
        <span className="contact-headset-band" />
        <span className="contact-headset-left" />
        <span className="contact-headset-right" />
        <span className="contact-headset-mic" />
        <span className="contact-headset-mic-dot" />
      </div>
    );
  }

  return defaultDotKeys.map((key) => <span key={key} />);
}

export function PageHero({
  eyebrow,
  title,
  description,
  variant = "company",
}: PageHeroProps) {
  return (
    <section className={`page-hero page-hero-${variant}`}>
      <div aria-hidden="true" className="page-hero-glow" />
      <div
        aria-hidden="true"
        className={`page-hero-art page-hero-art-${variant}`}
      >
        {renderHeroArtwork(variant)}
      </div>
      <Reveal className="page-hero-inner container">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </Reveal>
    </section>
  );
}
