import Link from "next/link";
import type { ReactNode } from "react";

import { StoreButtons } from "@/components/landing/store-buttons";

import {
  capabilities,
  howItWorks,
  navigation,
  watchlistItems,
} from "./content";
import { LandingIcon, type LandingIconName } from "./icons";
import { LandingBrand } from "./phone-frame";
import {
  DiscussionScreen,
  HomeScreen,
  NewsScreen,
  PriceAlertScreen,
  SignalScreen,
  StockScreen,
} from "./screens";

function PriceReachedCard({ className = "" }: { className?: string }) {
  return (
    <div className={`floating-card price-reached ${className}`}>
      <span className="floating-card__icon">
        <LandingIcon name="bell" />
      </span>
      <span>
        <small>목표가 도달</small>
        <b>삼성전자 85,500원</b>
        <em>지금 흐름을 다시 확인해 보세요.</em>
      </span>
    </div>
  );
}

function SummaryCard({ className = "" }: { className?: string }) {
  return (
    <div className={`floating-card summary-card ${className}`}>
      <span className="summary-card__thumb">MR</span>
      <span>
        <small>머니로드 요약</small>
        <b>반도체 업종에 유입된 수급과 실적 기대감이 함께 반영됐어요.</b>
      </span>
    </div>
  );
}

function MessageCard({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={`floating-card message-card ${className}`}>
      <span className="message-card__avatar">차</span>
      <span>
        <small>차트읽기</small>
        <b>{text}</b>
      </span>
    </div>
  );
}

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  body: string;
  bullets?: readonly string[];
  onDark?: boolean;
};

function SectionHeading({
  eyebrow,
  title,
  body,
  bullets = [],
  onDark = false,
}: SectionHeadingProps) {
  return (
    <div className={`section-heading ${onDark ? "section-heading--dark" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="section-heading__body">{body}</p>
      {bullets.length > 0 ? (
        <ul>
          {bullets.map((item) => (
            <li key={item}>
              <span>✓</span>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <nav aria-label="주요 메뉴" className="site-nav container">
        <a aria-label="머니로드 홈" className="site-nav__brand" href="#top">
          <LandingBrand />
        </a>
        <div className="site-nav__links">
          {navigation.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        <a className="site-nav__cta" href="#download">
          앱 다운로드
        </a>
      </nav>
    </header>
  );
}

function PhoneStack() {
  return (
    <div className="phone-stack">
      <div className="phone-stack__orb" />
      <div className="phone-stack__back">
        <PriceAlertScreen />
      </div>
      <div className="phone-stack__front">
        <HomeScreen />
      </div>
      <PriceReachedCard className="phone-float phone-float--price" />
      <SummaryCard className="phone-float phone-float--summary" />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="hero" id="top">
      <div className="hero__glow hero__glow--one" />
      <div className="hero__glow hero__glow--two" />
      <div className="hero__grid container">
        <div className="hero__copy">
          <p className="hero__eyebrow">
            <span /> 관심 종목부터 목표가 알림까지
          </p>
          <h1>
            보고 싶은 종목만,
            <br />
            <em>놓치고 싶지 않은 순간까지.</em>
          </h1>
          <p className="hero__body">
            현재가와 차트, 관심 종목 뉴스, <strong>머니로드 요약</strong>,
            목표가 알림과 토론을 한 흐름으로 확인하세요.
          </p>
          <div id="download">
            <StoreButtons variant="onDark" />
          </div>
          <p className="hero__helper">App Store · Google Play 정식 출시</p>
        </div>
        <div className="hero__visual">
          <PhoneStack />
        </div>
      </div>
      <div className="hero__scroll">
        <span />
        SCROLL
      </div>
    </section>
  );
}

function CapabilitySection() {
  return (
    <section aria-label="머니로드 핵심 기능" className="capability-wrap">
      <div className="capability-grid container">
        {capabilities.map((item) => (
          <article className="capability-card" key={item.title}>
            <span>
              <LandingIcon name={item.icon as LandingIconName} />
            </span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function WatchlistSection() {
  return (
    <section className="feature feature--watchlist" id="watchlist">
      <div className="feature__grid container">
        <div className="feature-visual feature-visual--light">
          <div className="feature-visual__circle" />
          <div className="single-phone single-phone--stock">
            <StockScreen />
          </div>
          {watchlistItems.slice(0, 2).map((item, index) => (
            <div
              className={`watch-float watch-float--${index + 1}`}
              key={item.code}
            >
              <span>{item.name.slice(0, 1)}</span>
              <div>
                <small>{item.name}</small>
                <b>{item.price}</b>
              </div>
              <em className={item.trend}>{item.change}</em>
            </div>
          ))}
        </div>
        <SectionHeading
          body="관심 종목을 등록하면 현재가와 흐름, 관련 뉴스와 시그널을 한곳에서 이어서 확인할 수 있어요."
          bullets={[
            "관심 종목 중심의 홈 화면",
            "종목 상세의 현재가와 차트",
            "관련 뉴스와 시그널 바로 연결",
          ]}
          eyebrow="관심 종목"
          title={
            <>
              내가 보는 종목만,
              <br />더 빠르게.
            </>
          }
        />
      </div>
    </section>
  );
}

function PriceAlertSection() {
  return (
    <section className="feature feature--alert" id="price-alert">
      <div className="feature--alert__glow" />
      <div className="feature__grid feature__grid--reverse container">
        <SectionHeading
          body="매수 또는 매도를 고민하는 가격을 미리 정해두세요. 목표가에 도달하면 다시 종목을 확인할 시점을 놓치지 않도록 알려드려요."
          bullets={[
            "현재가 기준 빠른 가격 설정",
            "원하는 가격 직접 입력",
            "알림에서 종목 상세로 바로 이동",
          ]}
          eyebrow="목표가 알림"
          onDark
          title={
            <>
              가격을 정해두면,
              <br />
              도달하는 순간 알려드려요.
            </>
          }
        />
        <div className="feature-visual feature-visual--dark">
          <div className="single-phone single-phone--alert">
            <PriceAlertScreen />
          </div>
          <PriceReachedCard className="section-float section-float--price" />
        </div>
      </div>
    </section>
  );
}

function NewsSection() {
  return (
    <section className="feature feature--news" id="news">
      <div className="feature__grid container">
        <div className="feature-visual feature-visual--news">
          <div className="news-backdrop-card">
            <span>오늘의 관심 뉴스</span>
            <b>3</b>
            <small>개의 새로운 맥락</small>
          </div>
          <div className="single-phone single-phone--news">
            <NewsScreen />
          </div>
          <SummaryCard className="section-float section-float--summary" />
        </div>
        <SectionHeading
          body="관심 종목과 시장 뉴스를 한곳에서 보고, 긴 기사는 머니로드 요약으로 핵심부터 확인하세요. 가격에 영향을 줄 수 있는 배경을 더 빠르게 살펴볼 수 있어요."
          bullets={[
            "관심 종목 뉴스만 모아보기",
            "시장·산업·정책 뉴스 탐색",
            "원문 출처로 이어지는 구조",
          ]}
          eyebrow="종목 뉴스"
          title={
            <>
              뉴스는 모으고,
              <br />
              핵심은 머니로드 요약으로.
            </>
          }
        />
      </div>
    </section>
  );
}

function DiscussionSection() {
  return (
    <section className="feature feature--discussion" id="discussion">
      <div className="feature__grid feature__grid--reverse container">
        <SectionHeading
          body="종목별 토론에서 다양한 의견과 대화 흐름을 확인하세요. 추가 매수나 매도를 결정하는 정답이 아니라, 시장 심리를 살펴보는 하나의 참고 정보가 됩니다."
          bullets={[
            "종목별 대화방 탐색",
            "빠르게 이어지는 대화 흐름",
            "관리 기능이 적용된 커뮤니티",
          ]}
          eyebrow="종목 토론"
          title={
            <>
              숫자만으로 부족할 때,
              <br />
              사람들의 분위기까지.
            </>
          }
        />
        <div className="feature-visual feature-visual--discussion">
          <div className="discussion-orbit discussion-orbit--one" />
          <div className="discussion-orbit discussion-orbit--two" />
          <div className="single-phone single-phone--discussion">
            <DiscussionScreen />
          </div>
          <MessageCard
            className="section-float section-float--message-one"
            text="시그널 근거와 뉴스도 같이 봤어요."
          />
          <MessageCard
            className="section-float section-float--message-two"
            text="목표가까지는 조금 더 지켜보려고요."
          />
        </div>
      </div>
    </section>
  );
}

function SignalSection() {
  return (
    <section className="feature feature--signals" id="signals">
      <div className="feature__grid container">
        <div className="feature-visual feature-visual--signals">
          <div className="signal-word signal-word--buy">매수</div>
          <div className="signal-word signal-word--hold">관망</div>
          <div className="signal-word signal-word--sell">매도</div>
          <div className="single-phone single-phone--signals">
            <SignalScreen />
          </div>
        </div>
        <SectionHeading
          body="현재가를 확인하고, 시그널의 방향과 근거를 읽고, 뉴스와 토론으로 맥락을 더하세요. 머니로드는 결정을 대신하지 않고 필요한 정보를 이어줍니다."
          bullets={[
            "방향과 강도를 함께 확인",
            "시그널 근거를 카드에서 바로 확인",
            "뉴스·토론·종목 상세로 이어지는 흐름",
          ]}
          eyebrow="매수 · 매도 · 관망 시그널"
          title={
            <>
              흩어진 정보가,
              <br />
              하나의 판단 흐름으로.
            </>
          }
        />
      </div>
    </section>
  );
}

function HowSection() {
  return (
    <section className="how-section">
      <div className="container">
        <div className="how-section__head">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>
            복잡한 시장 확인을,
            <br />
            하나의 루틴으로.
          </h2>
          <p>
            머니로드의 우상향 선은 수익을 약속하는 그래프가 아니라, 흩어진
            정보를 잇는 길을 의미합니다.
          </p>
        </div>
        <div className="how-road">
          <svg
            aria-hidden="true"
            className="how-road__line"
            preserveAspectRatio="none"
            viewBox="0 0 1000 180"
          >
            <path
              d="M20 140 C180 140 180 45 345 70 S580 145 690 80 S850 30 980 45"
              fill="none"
              stroke="currentColor"
              strokeDasharray="4 10"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
          {howItWorks.map((step) => (
            <article className="how-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="final-cta">
      <div className="final-cta__glow" />
      <div className="final-cta__content container">
        <div className="final-cta__icon">
          <LandingIcon name="arrow" />
        </div>
        <p className="eyebrow">YOUR MONEY, YOUR ROAD</p>
        <h2>
          내 종목을 보는
          <br />
          <em>더 선명한 방법, 머니로드.</em>
        </h2>
        <p>App Store와 Google Play에서 지금 시작하세요.</p>
        <StoreButtons variant="onDark" />
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__top">
          <LandingBrand />
          <a href="#top">맨 위로 ↑</a>
        </div>
        <div className="investment-notice">
          <b>투자 유의 안내</b>
          <p>
            머니로드가 제공하는 시세, 시그널, 뉴스 요약과 커뮤니티 정보는 투자
            판단을 돕기 위한 참고 정보입니다. 매매를 권유하거나 거래를 대신하지
            않으며, 모든 투자 판단과 책임은 투자자 본인에게 있습니다.
          </p>
        </div>
        <div className="site-footer__bottom">
          <span>© 2026 머니로드. All rights reserved.</span>
          <Link href="/privacy">개인정보 처리방침</Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="moneyroad-landing">
      <SiteHeader />
      <main>
        <HeroSection />
        <CapabilitySection />
        <WatchlistSection />
        <PriceAlertSection />
        <NewsSection />
        <DiscussionSection />
        <SignalSection />
        <HowSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
