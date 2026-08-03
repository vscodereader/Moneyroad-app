// MoneyRoad — mock data (ported from the design prototype's data.js)
// All Korean stocks (KOSPI/KOSDAQ). Prices/signals are fictional but plausible.

import type { SignalAction, SignalTypeKey } from "@/utils/theme";

export interface Stock {
  change: number;
  changePct: number;
  chart90: number[];
  code: string;
  color: string;
  hot: boolean;
  logo: string;
  logoTxt?: string;
  name: string;
  price: number;
  score: number;
  sector: string;
  signalBreakdown: {
    tech: number;
    ai: number;
    event: number;
    community: number;
  };
  spark: number[];
  watched: boolean;
}

export interface MarketIndex {
  change: number;
  changePct: number;
  name: string;
  value: number;
}

export interface Signal {
  action: SignalAction;
  body: string;
  code: string;
  id: string;
  name: string;
  // How the signal was derived (engine sets "tech" for now; others future).
  source: SignalTypeKey;
  strength: number;
  time: string;
  title: string;
}

export interface NewsItem {
  ai: string;
  /** True only when `ai` is a real AI-generated summary (not a description fallback). */
  aiGenerated?: boolean;
  category: string;
  code: string;
  id: string;
  /** 실제 대표 이미지(GCS 재호스팅). 없으면 UI에서 텍스트 썸네일 폴백. */
  imageUrl?: string | null;
  sentiment: "up" | "down";
  source: string;
  /** Stock name resolved from the API (real codes not in the dummy `stocks`). */
  stockName?: string | null;
  thumbHint: string;
  time: string;
  title: string;
}

export interface DiscussionRoom {
  author: string;
  body: string;
  code: string;
  id: string;
  likes: number;
  members: number;
  replies: number;
  sentiment: "up" | "down" | "neutral";
  time: string;
  title: string;
}

export interface ChatMessage {
  author: string;
  id: string;
  role?: "host";
  self?: boolean;
  sentiment?: "up" | "down";
  text: string;
  time: string;
}

export interface Notification {
  body: string;
  code: string;
  id: string;
  section: string;
  time: string;
  title: string;
  type: "signal" | "news" | "tech" | "price" | "community";
  unread: boolean;
}

// Deterministic sparkline generator from a seed string.
function sparkSeed(seed: string, len = 28, vol = 0.04, drift = 0): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: 32-bit integer hash
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const rand = () => {
    // biome-ignore lint/suspicious/noBitwiseOperators: 32-bit integer hash
    h = (h * 1_664_525 + 1_013_904_223) | 0;
    // biome-ignore lint/suspicious/noBitwiseOperators: unsigned 32-bit normalize
    return (h >>> 0) / 4_294_967_295;
  };
  const arr = [100];
  for (let i = 1; i < len; i++) {
    const r = (rand() - 0.5) * 2 * vol + drift;
    arr.push(Math.max(40, arr[i - 1] * (1 + r)));
  }
  return arr;
}

type StockSeed = Omit<Stock, "chart90" | "signalBreakdown">;

const stockSeeds: StockSeed[] = [
  {
    code: "005930",
    name: "삼성전자",
    sector: "반도체",
    price: 78_400,
    change: 1100,
    changePct: 1.42,
    logo: "삼",
    color: "#1428A0",
    score: 78,
    hot: true,
    spark: sparkSeed("005930", 28, 0.03, 0.002),
    watched: true,
  },
  {
    code: "000660",
    name: "SK하이닉스",
    sector: "반도체",
    price: 224_500,
    change: 5500,
    changePct: 2.51,
    logo: "SK",
    color: "#E0231B",
    score: 82,
    hot: true,
    spark: sparkSeed("000660", 28, 0.04, 0.003),
    watched: true,
  },
  {
    code: "035420",
    name: "NAVER",
    sector: "인터넷",
    price: 187_200,
    change: -2300,
    changePct: -1.21,
    logo: "N",
    color: "#03C75A",
    score: 54,
    hot: false,
    spark: sparkSeed("035420", 28, 0.035, -0.002),
    watched: true,
  },
  {
    code: "035720",
    name: "카카오",
    sector: "인터넷",
    price: 39_850,
    change: -250,
    changePct: -0.62,
    logo: "K",
    color: "#FEE500",
    score: 41,
    hot: false,
    spark: sparkSeed("035720", 28, 0.04, -0.001),
    watched: true,
    logoTxt: "#191919",
  },
  {
    code: "373220",
    name: "LG에너지솔루션",
    sector: "2차전지",
    price: 358_000,
    change: 8500,
    changePct: 2.43,
    logo: "LG",
    color: "#A50034",
    score: 71,
    hot: true,
    spark: sparkSeed("373220", 28, 0.045, 0.002),
    watched: true,
  },
  {
    code: "005380",
    name: "현대차",
    sector: "자동차",
    price: 232_500,
    change: -1500,
    changePct: -0.64,
    logo: "현",
    color: "#002C5F",
    score: 62,
    hot: false,
    spark: sparkSeed("005380", 28, 0.025, -0.0005),
    watched: true,
  },
  {
    code: "068270",
    name: "셀트리온",
    sector: "바이오",
    price: 178_900,
    change: 3400,
    changePct: 1.94,
    logo: "C",
    color: "#0064B0",
    score: 67,
    hot: false,
    spark: sparkSeed("068270", 28, 0.035, 0.001),
    watched: true,
  },
  {
    code: "323410",
    name: "카카오뱅크",
    sector: "금융",
    price: 24_750,
    change: 350,
    changePct: 1.43,
    logo: "kb",
    color: "#FEE500",
    score: 58,
    hot: false,
    spark: sparkSeed("323410", 28, 0.03, 0.0008),
    watched: true,
    logoTxt: "#191919",
  },
  {
    code: "034020",
    name: "두산에너빌리티",
    sector: "에너지/원전",
    price: 21_850,
    change: 950,
    changePct: 4.55,
    logo: "D",
    color: "#FFB81C",
    score: 88,
    hot: true,
    spark: sparkSeed("034020", 28, 0.05, 0.005),
    watched: false,
    logoTxt: "#191919",
  },
  {
    code: "207940",
    name: "삼성바이오로직스",
    sector: "바이오",
    price: 952_000,
    change: -8000,
    changePct: -0.83,
    logo: "SB",
    color: "#1428A0",
    score: 56,
    hot: false,
    spark: sparkSeed("207940", 28, 0.025, -0.001),
    watched: false,
  },
];

const clampScore = (n: number) => Math.min(100, Math.max(20, n));

export const stocks: Stock[] = stockSeeds.map((s) => ({
  ...s,
  chart90: sparkSeed(
    `d${s.code}`,
    90,
    0.025,
    s.changePct > 0 ? 0.0015 : -0.0008
  ),
  signalBreakdown: {
    tech: clampScore(s.score + Math.round(s.changePct * 3)),
    ai: clampScore(s.score + (s.hot ? 8 : -5)),
    event: clampScore(s.score + (s.code === "034020" ? 12 : -4)),
    community: clampScore(s.score + (s.sector.includes("반도체") ? 10 : 0)),
  },
}));

export const indices: MarketIndex[] = [
  { name: "KOSPI", value: 2742.18, change: 18.43, changePct: 0.68 },
  { name: "KOSDAQ", value: 869.04, change: -4.21, changePct: -0.48 },
];

export const news: NewsItem[] = [
  {
    id: "n1",
    code: "000660",
    category: "기업",
    title: "SK하이닉스, HBM4 양산 일정 6개월 앞당겨",
    source: "한국경제",
    time: "15분 전",
    thumbHint: "HBM4\n양산",
    sentiment: "up",
    ai: "엔비디아향 HBM4 공급 일정이 기존 2026년 1Q에서 2025년 3Q로 6개월 앞당겨질 가능성. 메모리 마진 가이던스 상향 가능성 시사. 단기 모멘텀 강화 요인.",
  },
  {
    id: "n2",
    code: "034020",
    category: "공시",
    title: "두산에너빌리티, 체코 원전 본계약 체결 공시",
    source: "전자공시",
    time: "1시간 전",
    thumbHint: "원전\n본계약",
    sentiment: "up",
    ai: "8조원대 EPC 매출 가시화. 향후 2027년까지 매출 인식 일정 확정. 관련 협력사 (효성중공업, 일진전기) 동반 강세 가능성.",
  },
  {
    id: "n3",
    code: "005930",
    category: "산업",
    title: "삼성전자 외국인 7거래일 연속 순매수…수급 개선",
    source: "연합인포맥스",
    time: "2시간 전",
    thumbHint: "외국인\n순매수",
    sentiment: "up",
    ai: "외국인 누적 순매수 +1.4조원. 단기 수급 개선 신호이나 옵션 만기일 변동성 주의. 80,000원선 저항 돌파 여부가 관건.",
  },
  {
    id: "n4",
    code: "035420",
    category: "기업",
    title: "NAVER 4분기 광고 매출 컨센서스 하회 전망",
    source: "매일경제",
    time: "3시간 전",
    thumbHint: "광고\n둔화",
    sentiment: "down",
    ai: "디스플레이 광고 부문 YoY -4% 전망. 커머스 성장으로 일부 상쇄. 목표가 하향 의견 우세 (-7% 평균).",
  },
  {
    id: "n5",
    code: "068270",
    category: "임상",
    title: "셀트리온 짐펜트라, 미국 시장 점유율 22% 돌파",
    source: "더벨",
    time: "5시간 전",
    thumbHint: "FDA\n점유율",
    sentiment: "up",
    ai: "출시 2년차에 점유율 22% 도달. 가이던스 상향 가능성 높음. 다만 환율 변동성에 따른 매출 영향 모니터링 필요.",
  },
  {
    id: "n6",
    code: "035720",
    category: "규제",
    title: "공정위, 플랫폼 독과점 규제안 발표 임박",
    source: "조선비즈",
    time: "7시간 전",
    thumbHint: "플랫폼\n규제",
    sentiment: "down",
    ai: "카카오 플랫폼 사업 매출의 14%가 영향권. 단기 투자 심리 위축 우려. 다만 핵심 사업 (모빌리티/페이) 구조적 영향은 제한적이라는 분석도.",
  },
];

export const discussionRooms: DiscussionRoom[] = [
  {
    id: "t1",
    code: "000660",
    title: "하이닉스 22만원 돌파, 25만원까지 보시는 분?",
    body: "외국인 매수세 7일 연속이고 HBM4 양산 일정도 당겨졌다는데, 단기 25만원까지는 무리 없어 보입니다. 다른 분들 의견 어떠신지...",
    author: "메모리장기",
    time: "5분 전",
    likes: 124,
    replies: 38,
    members: 87,
    sentiment: "up",
  },
  {
    id: "t2",
    code: "034020",
    title: "체코 원전 본계약! 드디어 결실",
    body: "1년 넘게 기다린 보람이 있네요. 추가 수주 모멘텀 이어질 듯합니다.",
    author: "원전러버",
    time: "23분 전",
    likes: 287,
    replies: 91,
    members: 142,
    sentiment: "up",
  },
  {
    id: "t3",
    code: "035720",
    title: "카카오 규제 이슈, 어디까지 빠질까요",
    body: "공정위 발표 임박이라는데... 4만원 이탈하면 손절 고민중입니다.",
    author: "초보투자",
    time: "1시간 전",
    likes: 56,
    replies: 47,
    members: 64,
    sentiment: "down",
  },
  {
    id: "t4",
    code: "005930",
    title: "삼성전자, 옵션 만기일 변동성 주의",
    body: "이번 주 옵션 만기 끼고 있어서 단기 변동성 조심하시는게 좋을 듯합니다. 7만원 후반 횡보 가능성.",
    author: "옵션마스터",
    time: "2시간 전",
    likes: 89,
    replies: 22,
    members: 41,
    sentiment: "neutral",
  },
  {
    id: "t5",
    code: "373220",
    title: "LG엔솔 IRA 추가 보조금 확정",
    body: "마진 개선 기대됩니다. 다만 GM 합작공장 가동률이 변수.",
    author: "배터리연구원",
    time: "3시간 전",
    likes: 142,
    replies: 31,
    members: 58,
    sentiment: "up",
  },
  {
    id: "t6",
    code: "068270",
    title: "셀트리온 점유율 22%, 추가 상승 여력은?",
    body: "짐펜트라 점유율 빠르게 올라가는데 약가 인하 압력은 어떻게 보시나요?",
    author: "바이오관망",
    time: "4시간 전",
    likes: 73,
    replies: 28,
    members: 36,
    sentiment: "neutral",
  },
];

export const notifications: Notification[] = [
  {
    id: "no1",
    section: "오늘",
    time: "5분 전",
    type: "signal",
    title: "두산에너빌리티 ⓘ 강력 매수 신호",
    body: "종합 시그널 점수 88점 — 체코 원전 본계약 공시",
    unread: true,
    code: "034020",
  },
  {
    id: "no2",
    section: "오늘",
    time: "1시간 전",
    type: "news",
    title: "SK하이닉스 관련 속보",
    body: "HBM4 양산 일정 6개월 앞당겨",
    unread: true,
    code: "000660",
  },
  {
    id: "no3",
    section: "오늘",
    time: "2시간 전",
    type: "tech",
    title: "삼성전자 외국인 순매수 알림",
    body: "7거래일 연속 순매수 — 누적 +1.4조원",
    unread: true,
    code: "005930",
  },
  {
    id: "no4",
    section: "오늘",
    time: "4시간 전",
    type: "price",
    title: "NAVER 목표가 도달",
    body: "설정한 도달가 185,000원 터치 (-1.2%)",
    unread: false,
    code: "035420",
  },
  {
    id: "no5",
    section: "어제",
    time: "1일 전",
    type: "signal",
    title: "LG에너지솔루션 ⓘ 매수 신호",
    body: "AI 모델 신뢰도 71% — IRA 보조금 추가 발표",
    unread: false,
    code: "373220",
  },
  {
    id: "no6",
    section: "어제",
    time: "1일 전",
    type: "community",
    title: "셀트리온 커뮤니티 토론 급증",
    body: "관심 종목 토론 활동량 +312%",
    unread: false,
    code: "068270",
  },
  {
    id: "no7",
    section: "이번 주",
    time: "3일 전",
    type: "tech",
    title: "현대차 RSI 과매도 진입",
    body: "RSI 28.4 — 단기 반등 구간 진입",
    unread: false,
    code: "005380",
  },
];

export const discussionRoomMessages: Record<string, ChatMessage[]> = {
  t2: [
    {
      id: "m1",
      author: "원전러버",
      role: "host",
      time: "23분 전",
      text: "체코 정부와 본계약 체결 공시 떴습니다. 1년 넘게 기다린 보람이 있네요.",
      sentiment: "up",
    },
    {
      id: "m2",
      author: "느긋한투자",
      time: "22분 전",
      text: "축하드립니다 🎉 저도 추격 매수 들어갑니다.",
    },
    {
      id: "m3",
      author: "팩트체커",
      time: "21분 전",
      text: "공시 원문 확인했습니다. 본계약 규모 8조원대, 2027년까지 매출 인식 일정 명시되어 있네요.",
      sentiment: "up",
    },
    {
      id: "m4",
      author: "차분히",
      time: "20분 전",
      text: "이미 선반영된거 아닌가요? 최근 상승분 대부분 기대감 반영으로 보이는데...",
      sentiment: "down",
    },
    {
      id: "m5",
      author: "원전러버",
      role: "host",
      time: "19분 전",
      text: "선반영 의견도 일리 있지만, 본계약은 가이던스 상향 가능성을 의미합니다. 추가 수주 모멘텀 가능.",
    },
    {
      id: "m6",
      author: "에너지전공",
      time: "17분 전",
      text: "참고로 SMR(소형모듈원전) 라인업도 한미 협력으로 진행 중입니다. 중장기 모멘텀까지 보면 좋아요.",
      sentiment: "up",
    },
    {
      id: "m7",
      author: "초보투자",
      time: "12분 전",
      text: "지금 진입해도 늦지 않을까요?",
    },
    {
      id: "m8",
      author: "느긋한투자",
      time: "10분 전",
      text: "@초보투자 적정 분할 매수 추천드려요. 단기 변동성은 있을 수 있어요.",
    },
    {
      id: "m9",
      author: "원전러버",
      role: "host",
      time: "8분 전",
      text: "다들 좋은 하루 보내세요. 다음 공시(추가 수주 or 가이던스) 나오면 다시 정리해서 올리겠습니다.",
    },
  ],
  t1: [
    {
      id: "m1",
      author: "메모리장기",
      role: "host",
      time: "5분 전",
      text: "22만원 돌파했네요. 외국인 매수세 7일 연속, HBM4 양산 일정 단축까지 겹쳐서 단기 25만원까지는 무리없어 보입니다.",
      sentiment: "up",
    },
    {
      id: "m2",
      author: "반도체팬",
      time: "5분 전",
      text: "동의합니다. 다만 옵션 만기일 변동성 주의하시는게 좋을 것 같아요.",
    },
    {
      id: "m3",
      author: "환율걱정",
      time: "4분 전",
      text: "환율이 떨어지면 외국인 매수세 약해질 수 있는 점도 변수에요.",
      sentiment: "down",
    },
    {
      id: "m4",
      author: "장기보유",
      time: "3분 전",
      text: "저는 25만원 보고 들어왔습니다. 단기 변동성 신경 안쓸 거에요.",
    },
  ],
  t3: [
    {
      id: "m1",
      author: "초보투자",
      role: "host",
      time: "1시간 전",
      text: "공정위 발표 임박이라는데 어디까지 빠질지 걱정이네요. 4만원 이탈하면 손절 고민중입니다.",
      sentiment: "down",
    },
    {
      id: "m2",
      author: "장기관망",
      time: "55분 전",
      text: "규제 이슈는 단기 노이즈일 가능성도 있어요. 핵심 사업 (모빌리티/페이) 구조적 영향은 제한적이라는 분석도 있고요.",
    },
    {
      id: "m3",
      author: "리스크관리",
      time: "50분 전",
      text: "발표 전까지 비중 줄여놓고 보는게 마음 편할 것 같아요.",
      sentiment: "down",
    },
    {
      id: "m4",
      author: "차분히",
      time: "40분 전",
      text: "주가 차트상 39,500원이 1차 지지선, 38,000원이 2차 지지선이에요.",
    },
  ],
  t4: [
    {
      id: "m1",
      author: "옵션마스터",
      role: "host",
      time: "2시간 전",
      text: "이번 주 옵션 만기 끼고 있어서 단기 변동성 조심하시는게 좋을 듯합니다. 7만원 후반 횡보 가능성이요.",
    },
    {
      id: "m2",
      author: "베가친구",
      time: "1시간 전",
      text: "맞아요. 콜옵션 매수 포지션 많이 쌓여있어서 만기 임팩트 큽니다.",
    },
  ],
  t5: [
    {
      id: "m1",
      author: "배터리연구원",
      role: "host",
      time: "3시간 전",
      text: "LG엔솔 IRA 추가 보조금 +1.2B USD 확정 보도. 마진 개선 기대됩니다. 다만 GM 합작공장 가동률이 변수에요.",
      sentiment: "up",
    },
    {
      id: "m2",
      author: "관망중",
      time: "2시간 전",
      text: "GM 합작공장 가동률 회복 데이터가 있나요?",
    },
  ],
  t6: [
    {
      id: "m1",
      author: "바이오관망",
      role: "host",
      time: "4시간 전",
      text: "짐펜트라 점유율 22% 빠르게 올라가는데 약가 인하 압력은 어떻게 보시나요?",
    },
    {
      id: "m2",
      author: "바이오학자",
      time: "3시간 전",
      text: "현재 의약품 약가 정책 변화 가능성 있어 모니터링 필요. 하지만 점유율 자체는 가이던스 상향 신호로 봐도 됩니다.",
      sentiment: "up",
    },
  ],
};

export const trending = [
  "034020",
  "000660",
  "005930",
  "373220",
  "068270",
  "207940",
];

export const recent = [
  "에코프로",
  "한화에어로스페이스",
  "현대차",
  "포스코퓨처엠",
];

export function findStock(code: string): Stock | undefined {
  return stocks.find((s) => s.code === code);
}
