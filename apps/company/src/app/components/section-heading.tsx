import type { ReactNode } from "react";

interface SectionHeadingProps {
  description?: ReactNode;
  eyebrow: string;
  title: ReactNode;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
