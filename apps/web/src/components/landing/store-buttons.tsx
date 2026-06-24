import { buttonVariants } from "@moneyroad-app/ui/components/button";
import { cn } from "@moneyroad-app/ui/lib/utils";
import Image from "next/image";

const STORE_LINKS = [
  {
    key: "app-store",
    href: "https://apps.apple.com/kr/app/%EB%A8%B8%EB%8B%88%EB%A1%9C%EB%93%9C/id6772923139",
    helper: "iPhone용",
    iconAlt: "App Store 아이콘",
    iconClassName: "h-7 w-7",
    iconHeight: 256,
    iconSrc: "/store-icons/app-store.png",
    iconWidth: 256,
    label: "App Store",
  },
  {
    key: "google-play",
    href: "https://play.google.com/store/apps/details?id=kr.ai.moneyroad",
    helper: "Android용",
    iconAlt: "Google Play 아이콘",
    iconClassName: "h-7 w-auto max-w-none",
    iconHeight: 78,
    iconSrc: "/store-icons/google-play.png",
    iconWidth: 366,
    label: "Google Play",
  },
] satisfies ReadonlyArray<{
  key: string;
  href: string;
  helper: string;
  iconAlt: string;
  iconClassName: string;
  iconHeight: number;
  iconSrc: string;
  iconWidth: number;
  label: string;
}>;

type StoreButtonsProps = {
  variant?: "default" | "onDark";
  className?: string;
};

export function StoreButtons({
  variant = "default",
  className,
}: StoreButtonsProps) {
  const onDark = variant === "onDark";
  const buttonVariant = onDark ? "outlineOnDark" : "outline";
  const helperClassName = onDark
    ? "text-primary-foreground/65 transition-colors group-hover/button:text-moneyroad-primary/70"
    : "text-muted-foreground";

  return (
    <div className={cn("flex w-full flex-col gap-3 sm:flex-row", className)}>
      {STORE_LINKS.map(
        ({
          href,
          helper,
          iconAlt,
          iconClassName,
          iconHeight,
          iconSrc,
          iconWidth,
          key,
          label,
        }) => (
          <a
            aria-label={`${label}에서 머니로드 다운로드`}
            className={cn(
              buttonVariants({ size: "store", variant: buttonVariant }),
              "min-w-0 flex-1 justify-center text-left"
            )}
            href={href}
            key={key}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span
              className="flex size-7 shrink-0 items-center overflow-hidden"
              data-icon="inline-start"
            >
              <Image
                alt={iconAlt}
                className={iconClassName}
                height={iconHeight}
                src={iconSrc}
                width={iconWidth}
              />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className={`text-xs ${helperClassName}`}>{helper}</span>
              <span className="truncate font-semibold text-base">{label}</span>
            </span>
          </a>
        )
      )}
    </div>
  );
}
