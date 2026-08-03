export const navigation = [
  { href: "#watchlist", label: "관심 종목" },
  { href: "#price-alert", label: "가격 알림" },
  { href: "#news", label: "뉴스" },
  { href: "#discussion", label: "토론" },
] as const;

export const capabilities = [
  {
    icon: "bookmark",
    title: "관심 종목",
    body: "보고 싶은 종목만 한곳에 모아요.",
  },
  {
    icon: "bell",
    title: "목표가 알림",
    body: "원하는 가격에 도달하면 알려드려요.",
  },
  {
    icon: "news",
    title: "머니로드 요약",
    body: "긴 기사의 핵심부터 빠르게 확인해요.",
  },
  {
    icon: "message",
    title: "시그널 · 토론",
    body: "종목의 방향과 시장 분위기를 함께 살펴봐요.",
  },
] as const;

export const watchlistItems = [
  {
    name: "삼성전자",
    code: "005930",
    price: "84,700원",
    change: "+2.13%",
    trend: "up",
  },
  {
    name: "SK하이닉스",
    code: "000660",
    price: "221,500원",
    change: "-0.82%",
    trend: "down",
  },
  {
    name: "NAVER",
    code: "035420",
    price: "212,000원",
    change: "+1.04%",
    trend: "up",
  },
] as const;

export const newsItems = [
  {
    category: "기업",
    stock: "삼성전자",
    title: "반도체 수요 회복 기대감, 시장이 주목한 지점은",
    source: "머니로드 뉴스 · 12분 전",
  },
  {
    category: "시장",
    stock: "SK하이닉스",
    title: "외국인 수급 변화와 반도체 업종의 흐름",
    source: "경제데일리 · 28분 전",
  },
  {
    category: "정책",
    stock: "시장",
    title: "이번 주 증시에 영향을 줄 주요 일정 정리",
    source: "마켓인사이트 · 1시간 전",
  },
] as const;

export const discussionMessages = [
  {
    author: "장기투자자",
    text: "오늘 뉴스 이후 거래량 흐름은 어떻게 보세요?",
    tag: "관망",
    self: false,
  },
  {
    author: "나",
    text: "목표가 알림 걸어두고 실적 발표까지 지켜보려고요.",
    tag: "관망",
    self: true,
  },
  {
    author: "차트읽기",
    text: "시그널 근거와 뉴스 내용을 같이 보는 게 좋겠네요.",
    tag: "매수",
    self: false,
  },
] as const;

export const signalItems = [
  {
    action: "매수",
    stock: "삼성전자",
    body: "거래량 증가와 단기 추세 전환을 함께 확인했어요.",
    strength: 4,
    tone: "buy",
  },
  {
    action: "관망",
    stock: "NAVER",
    body: "방향성이 뚜렷해질 때까지 흐름 확인이 필요해요.",
    strength: 3,
    tone: "hold",
  },
  {
    action: "매도",
    stock: "SK하이닉스",
    body: "단기 과열 구간 진입 여부를 확인해 보세요.",
    strength: 2,
    tone: "sell",
  },
] as const;

export const howItWorks = [
  {
    number: "01",
    title: "관심 종목을 담아요",
    body: "보고 싶은 종목을 중심으로 홈과 뉴스 흐름을 정리해요.",
  },
  {
    number: "02",
    title: "목표 가격을 정해요",
    body: "매수·매도를 다시 검토할 가격을 미리 설정해요.",
  },
  {
    number: "03",
    title: "뉴스와 시그널을 봐요",
    body: "머니로드 요약과 시그널 근거로 시장의 맥락을 읽어요.",
  },
  {
    number: "04",
    title: "토론까지 참고해요",
    body: "같은 종목을 보는 사람들의 의견까지 참고해 직접 판단해요.",
  },
] as const;
