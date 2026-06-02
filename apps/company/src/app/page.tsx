import {
  BarChart3,
  BookOpenCheck,
  Building2,
  Database,
  LineChart,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// NOTE: 아래 회사 정보(상호 제외)·신고번호·연락처는 편집용 자리표시값입니다.
// 실제 등록 정보로 교체하세요. 검색: "TODO:교체"
// ─────────────────────────────────────────────────────────────────────
const COMPANY = {
  name: "머니게이트",
  nameEn: "MoneyGate",
  // TODO:교체 — 실제 사업자등록번호
  bizNumber: "000-00-00000",
  // TODO:교체 — 금융위원회 유사투자자문업 신고번호
  reportNumber: "제2026-000000호",
  // TODO:교체 — 대표자명
  ceo: "홍길동",
  // TODO:교체 — 사업장 주소
  address: "서울특별시 강남구 테헤란로 000, 00층",
  // TODO:교체 — 대표 이메일
  email: "contact@moneygate.co.kr",
  // TODO:교체 — 대표 전화
  phone: "02-0000-0000",
} as const;

const FINE_URL =
  "https://fine.fss.or.kr/fine/fncco/invsmCnsut/list.do?menuNo=900046";

// ── 브랜드 마크 (우상향 라인차트) ────────────────────────────────────
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

function Wordmark({ tone = "light" }: { tone?: "light" | "dark" }) {
  const textColor = tone === "dark" ? "text-white" : "text-[#131416]";
  return (
    <span
      className={`flex items-center gap-2 font-bold text-lg tracking-tight ${textColor}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#256EF4] text-white">
        <LogoMark className="h-5 w-5" />
      </span>
      {COMPANY.name}
    </span>
  );
}

const NAV_LINKS = [
  { href: "#about", label: "회사 소개" },
  { href: "#business", label: "사업 영역" },
  { href: "#values", label: "핵심 가치" },
  { href: "#service", label: "서비스" },
  { href: "#compliance", label: "고지사항" },
] as const;

const STATS = [
  { value: "데이터 기반", label: "정량·정성 신호 종합" },
  { value: "유사투자자문업", label: "금융위원회 신고 사업자" },
  { value: "불특정 다수", label: "공정한 정보 제공 원칙" },
] as const;

const BUSINESS_AREAS = [
  {
    icon: BarChart3,
    title: "투자정보 콘텐츠 제공",
    body: "시장 흐름과 종목 동향을 분석한 투자 참고 정보를 불특정 다수의 투자자에게 제공합니다.",
    color: "#256EF4",
    bg: "#ECF2FE",
  },
  {
    icon: Database,
    title: "시장 데이터·시그널",
    body: "기술적 지표, 이벤트, 뉴스, 시장 심리를 정량화해 한눈에 파악할 수 있는 신호로 가공합니다.",
    color: "#6A4DD6",
    bg: "rgba(106,77,214,0.12)",
  },
  {
    icon: BookOpenCheck,
    title: "투자 리서치·교육",
    body: "투자자가 스스로 판단할 수 있도록 시장 리서치 자료와 투자 기초 콘텐츠를 발행합니다.",
    color: "#C97A0A",
    bg: "#FDF5E6",
  },
] as const;

const CORE_VALUES = [
  {
    icon: ShieldCheck,
    title: "투자자 보호 우선",
    body: "수익을 보장하지 않으며, 과장·허위 정보를 배제합니다. 모든 정보에는 투자 위험을 명확히 고지합니다.",
  },
  {
    icon: Target,
    title: "데이터에 기반한 판단",
    body: "감이나 소문이 아니라 검증 가능한 데이터와 일관된 기준으로 정보를 가공합니다.",
  },
  {
    icon: Sparkles,
    title: "투명한 정보 제공",
    body: "정보의 근거와 한계를 함께 밝혀, 투자자가 맥락을 이해하고 스스로 결정하도록 돕습니다.",
  },
] as const;

const SERVICE_POINTS = [
  "관심 종목의 시그널 점수를 0~100점으로 종합",
  "종목 뉴스와 AI 요약으로 시장 맥락 파악",
  "종목별 토론방으로 시장 심리 확인",
] as const;

const DISCLOSURES = [
  "머니게이트는 「자본시장과 금융투자업에 관한 법률」 제101조에 따라 금융위원회에 신고한 유사투자자문업자이며, 인가·등록을 받은 금융투자업자(투자자문업·투자일임업)가 아닙니다.",
  "당사는 불특정 다수를 대상으로 투자정보를 제공하며, 1:1 개별 투자자문이나 고객 자산을 대신 운용하는 투자일임 서비스를 제공하지 않습니다.",
  "제공되는 모든 정보는 투자 판단을 돕기 위한 참고 자료이며, 매매를 권유하지 않습니다. 투자의 최종 결정과 그 결과에 대한 책임은 투자자 본인에게 있습니다.",
  "모든 투자에는 원금 손실 위험이 있으며, 당사는 어떠한 형태의 수익도 보장하지 않습니다.",
] as const;

function CompanyInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-[#E6E8EA] border-b py-4 sm:flex-row sm:items-center sm:gap-6">
      <dt className="w-40 shrink-0 font-semibold text-[#58616A] text-sm">
        {label}
      </dt>
      <dd className="text-[#1E2124]">{value}</dd>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-svh bg-white text-[#131416]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-[#E6E8EA] border-b bg-white/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <a aria-label={`${COMPANY.name} 홈`} href="#top">
            <Wordmark />
          </a>
          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                className="font-medium text-[#58616A] text-sm transition-colors hover:text-[#131416]"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            className="rounded-full bg-[#256EF4] px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-[#0B50D0]"
            href="#contact"
          >
            문의하기
          </a>
        </nav>
      </header>

      <main id="top">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#F4F8FF] to-white" />
          <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
            <div className="flex max-w-3xl flex-col items-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#D6E4FF] bg-[#ECF2FE] px-3 py-1 font-semibold text-[#0B50D0] text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                금융위원회 신고 유사투자자문업자
              </span>
              <h1 className="mt-5 font-bold text-4xl text-[#131416] leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
                투자 판단을 돕는
                <br />
                <span className="text-[#256EF4]">데이터 기반 정보 파트너</span>
              </h1>
              <p className="mt-6 max-w-xl text-[#58616A] text-lg leading-relaxed">
                {COMPANY.name}는 흩어진 시장 정보를 데이터로 정리해, 투자자가 더
                나은 판단을 내리도록 돕습니다. 투명하고 책임 있는 투자정보
                서비스를 지향합니다.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  className="rounded-full bg-[#256EF4] px-6 py-3 text-center font-semibold text-base text-white transition-colors hover:bg-[#0B50D0]"
                  href="#business"
                >
                  사업 영역 보기
                </a>
                <a
                  className="rounded-full border border-[#CDD1D5] px-6 py-3 text-center font-semibold text-[#1E2124] text-base transition-colors hover:bg-[#F4F5F6]"
                  href="#contact"
                >
                  회사 정보·문의
                </a>
              </div>
            </div>

            <dl className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-[#E6E8EA] bg-[#E6E8EA] sm:grid-cols-3">
              {STATS.map((stat) => (
                <div className="bg-white px-6 py-7" key={stat.value}>
                  <dt className="font-bold text-2xl text-[#131416] tracking-tight">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-[#58616A] text-sm">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── About ── */}
        <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28" id="about">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <p className="font-semibold text-[#256EF4] text-sm">회사 소개</p>
              <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
                정보의 비대칭을 줄이는 일
              </h2>
            </div>
            <div className="space-y-5 text-[#58616A] text-lg leading-relaxed">
              <p>
                개인투자자는 늘 정보의 홍수와 부족을 동시에 겪습니다. 정보는
                많지만 신뢰할 만한 기준은 부족하고, 흩어진 데이터를 스스로
                해석하기란 쉽지 않습니다.
              </p>
              <p>
                {COMPANY.name}는 기술적 지표·이벤트·뉴스·시장 심리 등 흩어진
                신호를 일관된 기준으로 정리해, 누구나 이해할 수 있는 투자 참고
                정보로 가공합니다. 우리는 정답을 단정하지 않습니다. 다만 더 나은
                질문과 판단의 출발점을 제공합니다.
              </p>
            </div>
          </div>
        </section>

        {/* ── Business areas ── */}
        <section className="bg-[#F4F5F6]" id="business">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
            <div className="max-w-2xl">
              <p className="font-semibold text-[#256EF4] text-sm">사업 영역</p>
              <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
                투자정보를 다루는 세 가지 방식
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {BUSINESS_AREAS.map((area) => {
                const Icon = area.icon;
                return (
                  <div
                    className="rounded-3xl border border-[#E6E8EA] bg-white p-7"
                    key={area.title}
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: area.bg }}
                    >
                      <Icon className="h-6 w-6" style={{ color: area.color }} />
                    </span>
                    <h3 className="mt-5 font-bold text-[#131416] text-xl">
                      {area.title}
                    </h3>
                    <p className="mt-2 text-[#58616A] leading-relaxed">
                      {area.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Core values ── */}
        <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28" id="values">
          <div className="max-w-2xl">
            <p className="font-semibold text-[#256EF4] text-sm">핵심 가치</p>
            <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
              지키는 원칙이 곧 신뢰입니다
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {CORE_VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  className="rounded-3xl border border-[#E6E8EA] bg-white p-7"
                  key={value.title}
                >
                  <Icon className="h-7 w-7 text-[#256EF4]" />
                  <h3 className="mt-4 font-bold text-[#131416] text-xl">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-[#58616A] leading-relaxed">
                    {value.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Flagship service: 머니로드 ── */}
        <section className="bg-[#1E2124]" id="service">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 font-semibold text-[#7FA8FF] text-sm">
                <TrendingUp className="h-4 w-4" />
                대표 서비스
              </p>
              <h2 className="mt-3 font-bold text-3xl text-white tracking-tight sm:text-4xl">
                머니로드
              </h2>
              <p className="mt-4 max-w-md text-[#B1B8BE] text-lg leading-relaxed">
                {COMPANY.name}가 운영하는 투자 보조 앱입니다. 관심 종목의
                시그널·뉴스·토론을 한 화면에 모아, 흩어진 시장 정보를 투자자의
                결정 흐름에 맞춰 정리합니다.
              </p>
              <ul className="mt-7 space-y-3">
                {SERVICE_POINTS.map((point) => (
                  <li
                    className="flex items-start gap-3 text-[#E6E8EA]"
                    key={point}
                  >
                    <LineChart className="mt-0.5 h-5 w-5 shrink-0 text-[#7FA8FF]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-base text-white">삼성전자</p>
                  <p className="text-[#8A949E] text-xs">005930 · KOSPI</p>
                </div>
                <span className="rounded-full bg-[#FBEFEF] px-3 py-1 font-bold text-[#D6212F] text-xs">
                  매수
                </span>
              </div>
              <div className="mt-5 flex items-end gap-2">
                <span className="font-bold text-5xl text-white leading-none tracking-tight">
                  72
                </span>
                <span className="pb-1 font-medium text-[#8A949E] text-sm">
                  / 100
                </span>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#256EF4]"
                  style={{ width: "72%" }}
                />
              </div>
              <p className="mt-4 text-[#8A949E] text-xs leading-relaxed">
                ※ 화면은 이해를 돕기 위한 예시이며, 특정 종목의 매매를 권유하지
                않습니다.
              </p>
            </div>
          </div>
        </section>

        {/* ── Compliance / 법적 고지 ── */}
        <section
          className="border-[#E6E8EA] border-y bg-[#F4F5F6]"
          id="compliance"
        >
          <div className="mx-auto max-w-4xl px-5 py-20 lg:py-24">
            <p className="font-semibold text-[#256EF4] text-sm">고지사항</p>
            <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
              투자 유의사항 및 법적 고지
            </h2>
            <ul className="mt-8 space-y-4">
              {DISCLOSURES.map((text) => (
                <li
                  className="flex items-start gap-3 rounded-2xl border border-[#E6E8EA] bg-white p-5"
                  key={text.slice(0, 16)}
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#256EF4]" />
                  <p className="text-[#1E2124] leading-relaxed">{text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[#58616A] text-sm leading-relaxed">
              유사투자자문업 신고 현황은 금융감독원 금융소비자 정보포털{" "}
              <a
                className="font-semibold text-[#0B50D0] underline underline-offset-2"
                href={FINE_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                파인(FINE)
              </a>
              에서 확인하실 수 있습니다.
            </p>
          </div>
        </section>

        {/* ── Company info / Contact ── */}
        <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28" id="contact">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="font-semibold text-[#256EF4] text-sm">회사 정보</p>
              <h2 className="mt-2 font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
                {COMPANY.name} ({COMPANY.nameEn})
              </h2>
              <dl className="mt-8">
                <CompanyInfoRow label="대표자" value={COMPANY.ceo} />
                <CompanyInfoRow
                  label="사업자등록번호"
                  value={COMPANY.bizNumber}
                />
                <CompanyInfoRow
                  label="유사투자자문업 신고번호"
                  value={COMPANY.reportNumber}
                />
                <CompanyInfoRow label="주소" value={COMPANY.address} />
              </dl>
            </div>
            <div className="rounded-3xl bg-[#F4F5F6] p-8">
              <h3 className="font-bold text-[#131416] text-xl">문의</h3>
              <p className="mt-2 text-[#58616A] leading-relaxed">
                서비스 제휴, 투자정보 이용, 기타 문의는 아래 연락처로 전달해
                주세요.
              </p>
              <div className="mt-7 space-y-4">
                <a
                  className="flex items-center gap-3 text-[#1E2124] transition-colors hover:text-[#0B50D0]"
                  href={`mailto:${COMPANY.email}`}
                >
                  <Mail className="h-5 w-5 text-[#256EF4]" />
                  <span className="font-medium">{COMPANY.email}</span>
                </a>
                <a
                  className="flex items-center gap-3 text-[#1E2124] transition-colors hover:text-[#0B50D0]"
                  href={`tel:${COMPANY.phone.replace(/-/g, "")}`}
                >
                  <Phone className="h-5 w-5 text-[#256EF4]" />
                  <span className="font-medium">{COMPANY.phone}</span>
                </a>
                <div className="flex items-start gap-3 text-[#1E2124]">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#256EF4]" />
                  <span className="font-medium">{COMPANY.address}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-[#E6E8EA] border-t bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <Wordmark />
            <div className="flex items-center gap-2 text-[#58616A] text-sm">
              <Building2 className="h-4 w-4" />
              <span>
                {COMPANY.name} · 신고번호 {COMPANY.reportNumber}
              </span>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-[#F4F5F6] p-5">
            <p className="font-semibold text-[#1E2124] text-sm">
              투자 유의 안내
            </p>
            <p className="mt-2 text-[#58616A] text-sm leading-relaxed">
              {COMPANY.name}는 금융위원회에 신고된 유사투자자문업자이며, 정식
              금융투자업자가 아닙니다. 제공하는 모든 정보는 투자 판단을 돕기
              위한 참고 자료로, 매매를 권유하거나 수익을 보장하지 않습니다.
              투자의 최종 책임은 투자자 본인에게 있으며 원금 손실이 발생할 수
              있습니다.
            </p>
          </div>
          <p className="mt-6 text-[#8A949E] text-sm">
            © 2026 {COMPANY.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
