import {
  Bell,
  Bookmark,
  ChevronRight,
  LineChart,
  type LucideIcon,
  MessageSquare,
  Newspaper,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";

const iconComponents = {
  arrow: TrendingUp,
  bell: Bell,
  bookmark: Bookmark,
  chart: LineChart,
  chevron: ChevronRight,
  message: MessageSquare,
  news: Newspaper,
  search: Search,
  star: Star,
} satisfies Record<string, LucideIcon>;

export type LandingIconName = keyof typeof iconComponents;

type LandingIconProps = {
  name: LandingIconName;
  className?: string;
};

export function LandingIcon({ name, className = "" }: LandingIconProps) {
  const IconComponent = iconComponents[name];

  return (
    <IconComponent
      aria-hidden="true"
      className={`icon ${className}`}
      strokeWidth={2}
    />
  );
}
