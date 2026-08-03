import {
  discussionMessages,
  newsItems,
  signalItems,
  watchlistItems,
} from "./content";
import { LandingIcon } from "./icons";
import { AppNav, LandingBrand, PhoneFrame, StatusBar } from "./phone-frame";

type Trend = "up" | "down";

function MiniSpark({ trend = "up" }: { trend?: Trend }) {
  const path =
    trend === "up"
      ? "M2 22 C12 20 14 12 24 15 S36 7 48 10 S60 3 70 5"
      : "M2 5 C12 7 15 14 25 11 S38 20 48 16 S60 24 70 21";

  return (
    <svg
      aria-hidden="true"
      className={`mini-spark mini-spark--${trend}`}
      viewBox="0 0 72 28"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function WatchlistRows({ limit = watchlistItems.length }: { limit?: number }) {
  return (
    <>
      {watchlistItems.slice(0, limit).map((item) => (
        <div className="stock-row" key={item.code}>
          <span className="stock-row__logo">{item.name.slice(0, 1)}</span>
          <span className="stock-row__name">
            <b>{item.name}</b>
            <small>{item.code}</small>
          </span>
          <MiniSpark trend={item.trend} />
          <span className="stock-row__price">
            <b>{item.price}</b>
            <small className={`market-${item.trend}`}>{item.change}</small>
          </span>
        </div>
      ))}
    </>
  );
}

export function HomeScreen() {
  return (
    <PhoneFrame label="관심 종목과 시장 정보를 보여주는 머니로드 홈 화면">
      <div className="app-screen app-screen--home">
        <StatusBar />
        <div className="app-topbar">
          <LandingBrand />
          <span className="app-topbar__actions">
            <LandingIcon name="search" />
            <LandingIcon name="bell" />
          </span>
        </div>
        <div className="app-content">
          <p className="screen-kicker">좋은 아침이에요</p>
          <h3 className="screen-title">
            오늘 시장을
            <br />
            정리해볼까요?
          </h3>
          <div className="market-grid">
            <div className="market-card">
              <small>KOSPI</small>
              <b>2,847.15</b>
              <span className="market-up">+1.24%</span>
              <MiniSpark />
            </div>
            <div className="market-card">
              <small>KOSDAQ</small>
              <b>874.80</b>
              <span className="market-down">-0.68%</span>
              <MiniSpark trend="down" />
            </div>
          </div>
          <div className="screen-section-head">
            <b>내 관심 종목</b>
            <span>전체보기</span>
          </div>
          <div className="screen-card stock-list">
            <WatchlistRows limit={3} />
          </div>
          <div className="screen-section-head">
            <b>주요 뉴스</b>
            <span>더 보기</span>
          </div>
          <div className="home-news-card">
            <span className="news-thumb">MR</span>
            <span>
              <small>시장 · 삼성전자</small>
              <b>반도체 업종, 오늘 시장이 주목한 핵심은</b>
              <em>머니로드 요약</em>
            </span>
          </div>
        </div>
        <AppNav active="홈" />
      </div>
    </PhoneFrame>
  );
}

export function StockScreen() {
  return (
    <PhoneFrame label="현재가와 차트, 목표가 알림을 보여주는 종목 상세 화면">
      <div className="app-screen app-screen--stock">
        <StatusBar />
        <div className="stock-topbar">
          <span>‹</span>
          <b>삼성전자</b>
          <LandingIcon name="star" />
        </div>
        <div className="app-content">
          <span className="stock-code">005930 · KOSPI</span>
          <div className="stock-hero-price">
            <b>84,700원</b>
            <span>+1,770원 (+2.13%)</span>
          </div>
          <div className="big-chart">
            <svg aria-hidden="true" viewBox="0 0 340 160">
              <defs>
                <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#256ef4" stopOpacity=".25" />
                  <stop offset="1" stopColor="#256ef4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 130 C25 120 30 95 55 104 S92 72 118 82 S154 48 178 63 S218 28 243 47 S286 18 340 30 L340 160 L0 160Z"
                fill="url(#chart-fill)"
              />
              <path
                d="M0 130 C25 120 30 95 55 104 S92 72 118 82 S154 48 178 63 S218 28 243 47 S286 18 340 30"
                fill="none"
                stroke="#256ef4"
                strokeLinecap="round"
                strokeWidth="4"
              />
            </svg>
            <div className="chart-ranges">
              <b>1일</b>
              <span>1주</span>
              <span>1개월</span>
              <span>3개월</span>
              <span>1년</span>
            </div>
          </div>
          <span className="screen-alert-button">
            <LandingIcon name="bell" /> 목표가 알림 설정
          </span>
          <div className="screen-section-head">
            <b>종목 정보</b>
            <span>오늘 기준</span>
          </div>
          <div className="stock-stats">
            <span>
              <small>거래량</small>
              <b>18.4M</b>
            </span>
            <span>
              <small>52주 최고</small>
              <b>91,200</b>
            </span>
            <span>
              <small>52주 최저</small>
              <b>63,400</b>
            </span>
          </div>
          <div className="screen-section-head">
            <b>관련 뉴스</b>
            <span>3건</span>
          </div>
          <div className="stock-inline-news">
            <em>머니로드 요약</em>
            <b>실적 기대감과 수급 변화를 함께 확인해 보세요.</b>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

const alertPresets = [
  ["87,200원", "+3.0%"],
  ["85,500원", "+1.0%"],
  ["83,800원", "-1.0%"],
  ["82,100원", "-3.0%"],
] as const;

export function PriceAlertScreen() {
  return (
    <PhoneFrame label="목표 가격 이상과 이하 조건을 설정하는 가격 알림 화면">
      <div className="app-screen app-screen--alert">
        <StatusBar />
        <div className="stock-topbar">
          <span>‹</span>
          <b>가격 알림</b>
          <span />
        </div>
        <div className="app-content">
          <div className="alert-stock-card">
            <span className="stock-row__logo">삼</span>
            <span>
              <small>삼성전자 · 현재가</small>
              <b>84,700원</b>
            </span>
            <strong>+2.13%</strong>
          </div>
          <div className="alert-copy">
            <small>목표가 알림</small>
            <h3>
              다시 확인할 가격을
              <br />
              미리 정해두세요.
            </h3>
            <p>목표가 이상·이하에 도달하면 알려드려요.</p>
          </div>
          <div className="alert-presets">
            {alertPresets.map(([price, change], index) => (
              <div className="alert-preset" key={price}>
                <span>
                  <b>{price}</b>
                  <small>현재가보다 {change}</small>
                </span>
                <i className={`toggle ${index === 1 ? "is-on" : ""}`}>
                  <u />
                </i>
              </div>
            ))}
          </div>
          <span className="screen-secondary-button">직접 가격 입력하기</span>
          <p className="screen-note">
            예시 화면이며, 알림은 설정과 기기 상태에 따라 달라질 수 있어요.
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function NewsScreen() {
  return (
    <PhoneFrame label="관심 종목 뉴스와 머니로드 요약이 표시된 뉴스 화면">
      <div className="app-screen app-screen--news">
        <StatusBar />
        <div className="simple-screen-head">
          <b>뉴스</b>
          <LandingIcon name="search" />
        </div>
        <div className="news-tabs">
          <b>관심 종목</b>
          <span>전체</span>
          <span>시장</span>
          <span>산업</span>
          <span>정책</span>
        </div>
        <div className="news-list">
          {newsItems.map((item, index) => (
            <article className="news-row" key={item.title}>
              <span className={`news-thumb news-thumb--${index + 1}`}>
                {item.stock.slice(0, 1)}
              </span>
              <span className="news-row__copy">
                <small>
                  <em>{item.category}</em> {item.stock}
                </small>
                <b>{item.title}</b>
                <u>{item.source}</u>
                <i>머니로드 요약</i>
              </span>
            </article>
          ))}
        </div>
        <AppNav active="뉴스" />
      </div>
    </PhoneFrame>
  );
}

export function DiscussionScreen() {
  return (
    <PhoneFrame label="같은 종목을 보는 사용자들의 대화를 보여주는 종목 토론 화면">
      <div className="app-screen app-screen--discussion">
        <StatusBar />
        <div className="discussion-head">
          <span>‹</span>
          <span>
            <b>삼성전자 토론방</b>
            <small>
              <i /> 128명 참여 중
            </small>
          </span>
          <b>⋯</b>
        </div>
        <div className="discussion-topic">
          <small>오늘의 주제</small>
          <b>실적 발표 이후 흐름, 어떻게 보고 있나요?</b>
          <span># 삼성전자</span>
        </div>
        <div className="chat-list">
          {discussionMessages.map((message) => (
            <div
              className={`chat-message ${message.self ? "is-self" : ""}`}
              key={message.text}
            >
              <small>
                {message.author} · {message.tag}
              </small>
              <p>{message.text}</p>
              <time>오전 9:41</time>
            </div>
          ))}
        </div>
        <div className="chat-compose">
          <span>＋</span>
          <span>의견을 입력하세요</span>
          <b>↑</b>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function SignalScreen() {
  return (
    <PhoneFrame label="매수 매도 관망 시그널과 근거를 보여주는 시그널 화면">
      <div className="app-screen app-screen--signals">
        <StatusBar />
        <div className="simple-screen-head">
          <b>시그널</b>
          <span>24시간</span>
        </div>
        <div className="signal-summary">
          <small>최근 발견된 시그널</small>
          <b>12건</b>
          <span>매수 5 · 매도 3 · 관망 4</span>
        </div>
        <div className="signal-tabs">
          <b>전체</b>
          <span>매수</span>
          <span>매도</span>
          <span>관망</span>
        </div>
        <div className="signal-list">
          {signalItems.map((item) => (
            <article
              className={`signal-card signal-card--${item.tone}`}
              key={item.stock}
            >
              <div>
                <em>{item.action}</em>
                <small>{item.stock}</small>
                <time>12분 전</time>
              </div>
              <h4>{item.body}</h4>
              <div className="strength">
                <span>
                  {Array.from({ length: 5 }, (_, index) => (
                    <i
                      className={index < item.strength ? "is-on" : ""}
                      key={`${item.stock}-${index}`}
                    />
                  ))}
                </span>
                <b>{item.strength}/5</b>
              </div>
              <p>시그널은 투자 판단을 돕는 참고 정보예요.</p>
            </article>
          ))}
        </div>
        <AppNav active="시그널" />
      </div>
    </PhoneFrame>
  );
}
