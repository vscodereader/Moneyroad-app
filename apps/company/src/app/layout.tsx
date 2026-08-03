import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const wantedSans = localFont({
  src: "./fonts/WantedSansVariable.woff2",
  variable: "--font-wanted-sans",
  display: "swap",
  style: "normal",
  weight: "400 1000",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://moneygate.ai.kr"),
  title: {
    default: "머니게이트 — 데이터에서 판단까지",
    template: "%s | 머니게이트",
  },
  description:
    "머니게이트는 시장 데이터와 뉴스, 시그널을 이해하기 쉬운 맥락으로 정리하는 투자정보 회사입니다.",
  openGraph: {
    title: "머니게이트 — 데이터에서 판단까지",
    description:
      "공개된 시장 데이터와 뉴스, 시그널을 판단할 수 있는 흐름으로 정리합니다.",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "머니게이트 — 시장의 수많은 정보를 판단할 수 있는 흐름으로",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "머니게이트 — 데이터에서 판단까지",
    description:
      "공개된 시장 데이터와 뉴스, 시그널을 판단할 수 있는 흐름으로 정리합니다.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${wantedSans.variable} ${geistMono.variable} antialiased`}
      >
        <a className="skip-link" href="#main-content">
          본문으로 바로가기
        </a>
        {children}
      </body>
    </html>
  );
}
