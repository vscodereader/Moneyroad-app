// 머니로드 브랜드 마크/워드마크. 랜딩·개인정보 등 페이지에서 공용으로 쓴다.

// 우상향 라인차트 (native Icon.logo 재현)
export function LogoMark({ className }: { className?: string }) {
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

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-bold text-[#131416] text-lg tracking-tight">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#256EF4] text-white">
        <LogoMark className="h-5 w-5" />
      </span>
      머니로드
    </span>
  );
}
