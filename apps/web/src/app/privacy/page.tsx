import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/landing/brand";

export const metadata: Metadata = {
  title: "개인정보 처리방침 — 머니로드",
  description:
    "머니로드(MoneyRoad)가 「개인정보 보호법」에 따라 정보주체의 개인정보를 어떻게 처리·보호하는지 안내합니다.",
};

// NOTE: 본문은 앱(apps/native) 내 개인정보 처리방침(legal.tsx)과 동일한 내용을 유지한다.
// 한쪽을 수정하면 다른 쪽도 함께 갱신할 것.
const EFFECTIVE_DATE = "2026년 5월 29일";

const INTRO =
  "머니로드(이하 “회사”)는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 관련 고충을 신속하고 원활하게 처리하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.";

type Article = { heading: string; body: string[] };

const PRIVACY_ARTICLES: Article[] = [
  {
    heading: "제1조 (개인정보의 처리 목적)",
    body: [
      "회사는 다음의 목적을 위하여 개인정보를 처리하며, 목적이 변경되는 경우 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.",
      "1. 회원 가입 및 관리, 본인 확인, 서비스 부정이용 방지",
      "2. 서비스(시그널·뉴스·토론 등) 제공 및 맞춤형 콘텐츠 제공",
      "3. 고객 문의 응대 및 공지사항 전달",
    ],
  },
  {
    heading: "제2조 (처리하는 개인정보 항목)",
    body: [
      "1. 필수항목: 이메일 주소, 비밀번호(또는 소셜 로그인 식별자), 닉네임",
      "2. 자동 수집항목: 서비스 이용기록, 접속 로그, 기기정보(OS·기기식별자), 푸시 토큰",
      "3. 선택항목: 관심 종목 등 이용자가 직접 입력하는 정보",
    ],
  },
  {
    heading: "제3조 (개인정보의 처리 및 보유 기간)",
    body: [
      "1. 회사는 법령에 따른 보유기간 또는 정보주체로부터 동의받은 보유기간 내에서 개인정보를 처리·보유합니다.",
      "2. 회원 정보는 회원 탈퇴 시까지 보유하며, 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령(전자상거래 등에서의 소비자보호에 관한 법률 등)에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.",
    ],
  },
  {
    heading: "제4조 (개인정보의 제3자 제공)",
    body: [
      "회사는 정보주체의 동의, 법령의 특별한 규정 등 「개인정보 보호법」 제17조에 해당하는 경우를 제외하고는 개인정보를 제3자에게 제공하지 않습니다.",
    ],
  },
  {
    heading: "제5조 (개인정보 처리의 위탁)",
    body: [
      "회사는 원활한 서비스 제공을 위하여 필요한 범위에서 개인정보 처리업무를 외부에 위탁할 수 있으며(예: 클라우드 인프라, 푸시 알림 발송 등), 위탁 시 수탁자와 위탁업무의 내용을 본 방침을 통해 공개하고 관련 법령에 따라 관리·감독합니다.",
    ],
  },
  {
    heading: "제6조 (정보주체의 권리·의무 및 행사방법)",
    body: [
      "정보주체는 언제든지 개인정보의 열람·정정·삭제·처리정지를 요구할 수 있으며, 회사는 관련 법령에 따라 지체 없이 조치합니다. 권리 행사는 서비스 내 기능 또는 아래 개인정보 보호책임자의 연락처를 통해 할 수 있습니다.",
    ],
  },
  {
    heading: "제7조 (개인정보의 파기)",
    body: [
      "회사는 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때 지체 없이 파기합니다. 전자적 파일은 복구·재생할 수 없는 방법으로 삭제하며, 출력물 등은 분쇄하거나 소각합니다.",
    ],
  },
  {
    heading: "제8조 (개인정보의 안전성 확보조치)",
    body: [
      "회사는 개인정보의 안전한 처리를 위하여 접근권한 관리, 접근통제, 비밀번호의 암호화, 접속기록의 보관·점검 등 관리적·기술적 보호조치를 시행합니다.",
    ],
  },
  {
    heading: "제9조 (개인정보 보호책임자)",
    body: [
      "회사는 개인정보 처리에 관한 업무를 총괄하는 개인정보 보호책임자를 다음과 같이 지정합니다.",
      "· 개인정보 보호책임자: 김종현 / 대표",
      "· 연락처: support@moneyroad.ai.kr",
    ],
  },
  {
    heading: "제10조 (권익침해 구제방법)",
    body: [
      "정보주체는 아래 기관에 분쟁해결·상담 등을 신청할 수 있습니다.",
      "· 개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)",
      "· 개인정보침해신고센터: 118 (privacy.kisa.or.kr)",
      "· 대검찰청 사이버수사과: 1301 (www.spo.go.kr)",
      "· 경찰청 사이버수사국: 182 (ecrm.police.go.kr)",
    ],
  },
  {
    heading: "부칙",
    body: [`이 개인정보 처리방침은 ${EFFECTIVE_DATE}부터 적용됩니다.`],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-svh bg-white text-[#131416]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-[#E6E8EA] border-b bg-white/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Link aria-label="머니로드 홈으로" href="/">
            <Wordmark />
          </Link>
          <Link
            className="rounded-full border border-[#D6E4FF] bg-[#ECF2FE] px-4 py-2 font-semibold text-[#0B50D0] text-sm transition-colors hover:bg-[#D6E4FF]"
            href="/"
          >
            홈으로
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <h1 className="font-bold text-3xl text-[#131416] tracking-tight sm:text-4xl">
          개인정보 처리방침
        </h1>
        <p className="mt-3 text-[#8A949E] text-sm">시행일: {EFFECTIVE_DATE}</p>
        <p className="mt-6 text-[#58616A] leading-relaxed">{INTRO}</p>

        <div className="mt-10 space-y-9">
          {PRIVACY_ARTICLES.map((article) => (
            <section key={article.heading}>
              <h2 className="font-bold text-[#131416] text-lg">
                {article.heading}
              </h2>
              <div className="mt-3 space-y-1.5">
                {article.body.map((paragraph) => (
                  <p className="text-[#58616A] leading-relaxed" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-[#E6E8EA] border-t bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <p className="text-[#8A949E] text-sm">
            © 2026 머니로드. All rights reserved.
          </p>
          <Link
            className="font-medium text-[#256EF4] text-sm transition-colors hover:text-[#0B50D0]"
            href="/"
          >
            머니로드 홈 →
          </Link>
        </div>
      </footer>
    </div>
  );
}
