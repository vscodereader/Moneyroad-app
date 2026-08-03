import Image from "next/image";

const STORE_LINKS = [
  {
    key: "app-store",
    href: "https://apps.apple.com/kr/app/%EB%A8%B8%EB%8B%88%EB%A1%9C%EB%93%9C/id6772923139",
    helper: "iPhone용",
    iconClassName: "store-icon store-icon--apple",
    iconHeight: 256,
    iconSrc: "/store-icons/app-store.png",
    iconWidth: 256,
    label: "App Store",
  },
  {
    key: "google-play",
    href: "https://play.google.com/store/apps/details?id=kr.ai.moneyroad",
    helper: "Android용",
    iconClassName: "store-icon store-icon--play",
    iconHeight: 78,
    iconSrc: "/store-icons/google-play.png",
    iconWidth: 366,
    label: "Google Play",
  },
] as const;

type StoreButtonsProps = {
  variant?: "default" | "onDark";
  className?: string;
};

export function StoreButtons({
  variant = "default",
  className = "",
}: StoreButtonsProps) {
  const darkClassName = variant === "onDark" ? "store-buttons--dark" : "";

  return (
    <div className={`store-buttons ${darkClassName} ${className}`.trim()}>
      {STORE_LINKS.map((store) => (
        <a
          aria-label={`${store.label}에서 머니로드 다운로드`}
          href={store.href}
          key={store.key}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className={store.iconClassName}>
            <Image
              alt=""
              height={store.iconHeight}
              src={store.iconSrc}
              width={store.iconWidth}
            />
          </span>
          <span>
            <small>{store.helper}</small>
            <b>{store.label}</b>
          </span>
        </a>
      ))}
    </div>
  );
}
