import Image from "next/image";

import { WaitlistForm } from "@/components/landing/waitlist-form";

// ── Brand mark (우상향 라인차트, native Icon.logo 재현) ──────────────
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.8}
      viewBox="0 0 24 24"
    >
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-bold text-[#131416] text-lg tracking-tight">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#256EF4] text-white">
        <LogoMark className="h-5 w-5" />
      </span>
      머니로드
    </span>
  );
}

// ── 디바이스 목업 프레임 ─────────────────────────────────────────────
function PhoneFrame({
  src,
  alt,
  width,
  height,
  priority,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  return (
    <div className="rounded-[2.75rem] border border-[#E6E8EA] bg-[#1E2124] p-2.5 shadow-[0_40px_80px_-20px_rgba(19,20,22,0.35)]">
      <div className="overflow-hidden rounded-[2.1rem] bg-white">
        <Image
          alt={alt}
          className="h-auto w-full"
          height={height}
          priority={priority}
          src={src}
          width={width}
        />
      </div>
    </div>
  );
}

// ── 시그널 점수 그래픽 (실데이터 없어 디자인 토큰으로 재현) ──────────
const SIGNAL_TYPES = [
  { key: "tech", label: "기술적", color: "#256EF4", bg: "#ECF2FE" },
  {
    key: "ai",
    label: "AI 모델",
    color: "#6A4DD6",
    bg: "rgba(106,77,214,0.12)",
  },
  { key: "event", label: "이벤트", color: "#C97A0A", bg: "#FDF5E6" },
  { key: "community", label: "커뮤니티", color: "#198043", bg: "#E6F4EC" },
] as const;

function SignalScoreCard() {
  const score = 72;
  return (
    <div className="w-full max-w-sm rounded-3xl border border-[#E6E8EA] bg-white p-6 shadow-[0_24px_60px_-24px_rgba(19,20,22,0.25)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-[#131416] text-base">삼성전자</p>
          <p className="text-[#8A949E] text-xs">005930 · KOSPI</p>
        </div>
        <span className="rounded-full bg-[#FBEFEF] px-3 py-1 font-bold text-[#D6212F] text-xs">
          매수
        </span>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className="font-bold text-5xl text-[#131416] leading-none tracking-tight">
          {score}
        </span>
        <span className="pb-1 font-medium text-[#8A949E] text-sm">/ 100</span>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#F4F5F6]">
        <div
          className="h-full rounded-full bg-[#256EF4]"
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {SIGNAL_TYPES.map((s) => (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            key={s.key}
            style={{ backgroundColor: s.bg }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="font-semibold text-xs" style={{ color: s.color }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 토론방 카드 그래픽 ───────────────────────────────────────────────
function DiscussionCard() {
  return (
    <div className="w-full max-w-sm rounded-3xl border border-[#E6E8EA] bg-white p-5 shadow-[0_24px_60px_-24px_rgba(19,20,22,0.25)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#256EF4] font-bold text-sm text-white">
            삼
          </span>
          <div>
            <p className="font-semibold text-[#131416] text-sm">
              삼성전자 토론방
            </p>
            <p className="text-[#8A949E] text-xs">참여자 1,284명</p>
          </div>
        </div>
        <span className="rounded-full bg-[#FBEFEF] px-2.5 py-1 font-bold text-[#D6212F] text-xs">
          긍정
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="rounded-2xl rounded-tl-md bg-[#F4F5F6] px-3.5 py-2.5 text-[#1E2124] text-sm">
          실적 발표 이후 분위기 어떤가요?
        </div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-[#ECF2FE] px-3.5 py-2.5 text-[#0B50D0] text-sm">
          시그널 점수도 어제보다 올랐네요 👀
        </div>
      </div>
    </div>
  );
}

const FEATURE_STEPS = [
  {
    n: "01",
    title: "관심 종목을 골라요",
    body: "보유 중이거나 지켜보는 종목을 담으면 머니로드가 그 종목만 추적합니다.",
  },
  {
    n: "02",
    title: "시그널 점수를 확인해요",
    body: "기술적·AI·이벤트·커뮤니티 신호를 종합한 0~100점으로 흐름을 한눈에 봅니다.",
  },
  {
    n: "03",
    title: "뉴스·토론으로 맥락을 잡아요",
    body: "점수 뒤의 이유를 종목 뉴스 요약과 토론방 분위기로 빠르게 파악합니다.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-svh bg-white text-[#131416]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-[#E6E8EA] border-b bg-white/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Wordmark />
          <a
            className="rounded-full bg-[#256EF4] px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-[#0B50D0]"
            href="#waitlist"
          >
            사전등록
          </a>
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#F4F8FF] to-white" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
            <div className="flex flex-col items-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#D6E4FF] bg-[#ECF2FE] px-3 py-1 font-semibold text-[#0B50D0] text-xs">
                한국 개인투자자를 위한 투자 보조 앱
              </span>
              <h1 className="mt-5 font-bold text-4xl text-[#131416] leading-[1.15] tracking-tight sm:text-5xl">
                감으로 사지 말고,
                <br />
                <span className="text-[#256EF4]">신호로 판단하세요</span>
              </h1>
              <p className="mt-5 max-w-md text-[#58616A] text-lg leading-relaxed">
                관심 종목의 시그널·뉴스·토론을 한 화면에서. 머니로드가 흩어진
                시장 정보를 당신의 결정 흐름에 맞춰 정리합니다.
              </p>
              <div className="mt-8 w-full max-w-md" id="waitlist">
                <WaitlistForm />
                <p className="mt-3 text-[#8A949E] text-sm">
                  출시 알림만 보내드려요. 스팸은 없습니다.
                </p>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xs lg:max-w-sm">
              <PhoneFrame
                alt="머니로드 홈 화면 — KOSPI·KOSDAQ 지수와 관심 종목 뉴스"
                height={1270}
                priority
                src="/screens/home.png"
                width={720}
              />
              <div className="absolute bottom-12 -left-10 hidden w-64 lg:block">
                <SignalScoreCard />
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature: 시그널 점수 ── */}
        <section className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 flex justify-center lg:order-1">
              <SignalScoreCard />
            </div>
            <div className="order-1 lg:order-2">
              <p className="font-semibold text-[#256EF4] text-sm">
                시그널 점수
              </p>
              <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
                4가지 신호를 하나의 점수로
              </h2>
              <p className="mt-4 max-w-md text-[#58616A] text-lg leading-relaxed">
                기술적 지표, AI 모델, 공시·실적 이벤트, 커뮤니티 언급량까지.
                흩어진 신호를 종합해 0~100점으로 보여주고 매수·매도·관망을
                한눈에 정리합니다.
              </p>
              <ul className="mt-6 space-y-3">
                {SIGNAL_TYPES.map((s) => (
                  <li className="flex items-center gap-3" key={s.key}>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-[#1E2124]">{s.label} 신호</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Feature: 뉴스 + AI 요약 ── */}
        <section className="bg-[#F4F5F6]">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="font-semibold text-[#256EF4] text-sm">종목 뉴스</p>
              <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
                관심 종목 뉴스만, 요약까지
              </h2>
              <p className="mt-4 max-w-md text-[#58616A] text-lg leading-relaxed">
                포털을 떠돌 필요 없이 관심 종목 뉴스를 한곳에 모읍니다. 긴
                기사는 AI가 핵심만 추려 요약해, 무엇이 가격을 움직이는지 빠르게
                파악할 수 있어요.
              </p>
            </div>
            <div className="mx-auto w-full max-w-xs lg:max-w-sm">
              <PhoneFrame
                alt="머니로드 뉴스 화면 — 관심 종목별 뉴스와 AI 요약"
                height={1560}
                src="/screens/news.png"
                width={720}
              />
            </div>
          </div>
        </section>

        {/* ── Feature: 토론방 ── */}
        <section className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 flex justify-center lg:order-1">
              <DiscussionCard />
            </div>
            <div className="order-1 lg:order-2">
              <p className="font-semibold text-[#256EF4] text-sm">
                종목 토론방
              </p>
              <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
                같은 종목을 보는 사람들과
              </h2>
              <p className="mt-4 max-w-md text-[#58616A] text-lg leading-relaxed">
                종목별 토론방에서 다른 투자자들의 의견과 방의
                분위기(긍정·중립·부정)를 확인하세요. 숫자 너머의 시장 심리를
                읽는 또 하나의 신호입니다.
              </p>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="bg-[#F4F5F6]">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <h2 className="text-center font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
              3단계면 충분해요
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {FEATURE_STEPS.map((step) => (
                <div
                  className="rounded-3xl border border-[#E6E8EA] bg-white p-7"
                  key={step.n}
                >
                  <span className="font-bold text-[#256EF4] text-sm">
                    {step.n}
                  </span>
                  <h3 className="mt-3 font-bold text-[#131416] text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[#58616A] leading-relaxed">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA 밴드 ── */}
        <section className="bg-[#1E2124]">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            <h2 className="font-bold text-3xl text-white tracking-tight sm:text-4xl">
              출시되면 가장 먼저 알려드릴게요
            </h2>
            <p className="mt-4 text-[#B1B8BE] text-lg">
              지금 사전등록하고 머니로드의 첫 사용자가 되어보세요.
            </p>
            <div className="mx-auto mt-8 max-w-md">
              <WaitlistForm variant="onDark" />
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-[#E6E8EA] border-t bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <Wordmark />
          <div className="mt-6 rounded-2xl bg-[#F4F5F6] p-5">
            <p className="font-semibold text-[#1E2124] text-sm">
              투자 유의 안내
            </p>
            <p className="mt-2 text-[#58616A] text-sm leading-relaxed">
              머니로드가 제공하는 시그널·점수·뉴스 요약은 투자자의 판단을
              보조하기 위한 정보이며, 매매를 권유하거나 대신 거래하지 않습니다.
              모든 투자의 책임은 투자자 본인에게 있습니다.
            </p>
          </div>
          <p className="mt-6 text-[#8A949E] text-sm">
            © 2026 머니로드. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
