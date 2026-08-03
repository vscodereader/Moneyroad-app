import type { Metadata } from "next";
import { HeroWave } from "./components/hero-wave";
import { InstitutionStrip } from "./components/institution-strip";
import { MoneyroadMockup } from "./components/moneyroad-mockup";
import { Reveal } from "./components/reveal";
import { SectionHeading } from "./components/section-heading";
import { SiteShell } from "./components/site-shell";
import {
  faqs,
  homeBusinessAreas,
  notices,
  principles,
  processSteps,
  serviceFeatures,
} from "./content";

export const metadata: Metadata = {
  title: "머니게이트 — 데이터에서 판단까지",
  description:
    "공개된 시장 데이터와 뉴스, 시그널을 판단할 수 있는 흐름으로 정리합니다.",
};

export default function Home() {
  return (
    <SiteShell>
      <main id="main-content">
        <section className="hero">
          <HeroWave />
          <div aria-hidden="true" className="hero-stars" />
          <div className="hero-inner container">
            <Reveal className="hero-copy">
              <p className="eyebrow">DATA · CONTEXT · RESPONSIBILITY</p>
              <h1>
                <span className="headline-line headline-primary">
                  흔들리지 않는 당신만의 투자 관문,
                </span>
                <span className="headline-line headline-accent">
                  머니게이트
                </span>
              </h1>
              <p className="hero-description">
                <span>
                  쏟아지는 정보와 불확실성 속에서, 오직 당신의 성공적인 투자를
                  위한 가장 명확하고 안전한 진입로가 되어 드립니다.
                </span>
              </p>
              <div className="button-row">
                <a
                  className="button button-primary"
                  href="https://moneyroad.ai.kr/"
                >
                  머니로드 알아보기
                </a>
                <a className="button button-ghost" href="/company">
                  회사 소개 보기
                </a>
              </div>
            </Reveal>

            <dl className="hero-facts">
              {[
                ["불특정 다수", "모든 이용자에게 같은 정보"],
                ["데이터 기반", "시장 변화와 근거를 함께"],
                ["판단 지원", "매매를 대신하지 않는 정보"],
                ["위험 고지", "한계와 손실 가능성 안내"],
              ].map(([value, label]) => (
                <div key={value}>
                  <dt>{value}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div aria-hidden="true" className="scroll-cue">
            <span />
            SCROLL
          </div>
        </section>

        <section className="section section-alt tone-why">
          <div className="split-intro container">
            <Reveal>
              <p className="eyebrow">WHY MONEYGATE</p>
              <h2 className="display-title">
                <span className="title-line">넘쳐나는 노이즈,</span>
                <span className="title-line">가장 선명한 기준이 되다.</span>
              </h2>
            </Reveal>
            <Reveal className="intro-copy" delay={120}>
              <p>
                매일 쏟아지는 뉴스, 공시, 차트 데이터. 파편화된 정보들을 하나로
                연결해 투자의 진짜 흐름을 읽어냅니다.
              </p>
              <p>
                머니게이트는 섣부른 정답을 강요하지 않습니다. 무엇이 변했고 어떤
                맥락을 주목해야 하는지 투명하게 보여주어, 당신만의 확고한 판단을
                돕습니다.
              </p>
              <a className="text-link" href="/company">
                머니게이트 이야기 <span>↗</span>
              </a>
            </Reveal>
          </div>
        </section>

        <section className="section tone-business">
          <div className="container">
            <Reveal>
              <SectionHeading
                description={
                  <span className="single-line-desktop">
                    시장 정보의 발견부터 이해까지, 투자자가 스스로 판단하는
                    과정에 필요한 기반을 만듭니다.
                  </span>
                }
                eyebrow="WHAT WE DO"
                title="투자의 3가지 솔루션"
              />
            </Reveal>
            <div className="card-grid three">
              {homeBusinessAreas.map((area, index) => (
                <Reveal
                  className="feature-card"
                  delay={index * 90}
                  key={area.title}
                >
                  <div aria-hidden="true" className="card-icon">
                    {area.mark}
                  </div>
                  <h3>{area.title}</h3>
                  <p>{area.description}</p>
                  <ul className="mini-list">
                    {area.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-alt tone-product overflow-hidden">
          <div className="product-split container">
            <Reveal className="product-copy">
              <p className="eyebrow">FLAGSHIP SERVICE</p>
              <h2 className="display-title product-title">
                <span className="title-line">관심 종목의 중요한</span>
                <span className="title-line">순간을 한곳에서</span>
              </h2>
              <p className="section-lead">
                머니로드는 관심 종목의 시세와 차트, 뉴스와 머니로드 요약, 가격
                알림, 매수·매도·관망 시그널, 종목별 토론을 하나의 흐름으로
                연결한 투자 보조 서비스입니다.
              </p>
              <div className="feature-pills">
                {serviceFeatures.map((feature) => (
                  <span key={feature.title}>{feature.title}</span>
                ))}
              </div>
              <a
                className="button button-primary"
                href="https://moneyroad.ai.kr/"
              >
                머니로드 자세히 보기
              </a>
            </Reveal>
            <Reveal delay={140}>
              <MoneyroadMockup />
            </Reveal>
          </div>
        </section>

        <section className="section tone-process">
          <div className="container">
            <Reveal>
              <SectionHeading
                description="쏟아지는 데이터를 그대로 전달하지 않습니다. 8단계의 깐깐한 검증과 정제 과정을 거쳐 가장 신뢰할 수 있는 정보만 남깁니다."
                eyebrow="HOW IT WORKS"
                title="노이즈는 거르고, 인사이트는 정제하다"
              />
            </Reveal>
            <div className="process-grid process-track">
              {processSteps.slice(0, 4).map((step, index) => (
                <div className="process-node" key={step.number}>
                  <Reveal className="process-card" delay={index * 90}>
                    <span className="process-number">{step.number}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </Reveal>
                  {index < 3 ? (
                    <span
                      aria-hidden="true"
                      className="process-track-connector"
                    >
                      →
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <Reveal className="center-action">
              <a className="button button-ghost" href="/service#process">
                전체 흐름 보기
              </a>
            </Reveal>
          </div>
        </section>

        <section className="section section-blueprint tone-principles">
          <div className="container">
            <Reveal>
              <SectionHeading
                description="정답을 약속하지 않습니다. 대신 정보의 근거와 한계, 투자자가 주의해야 할 부분을 함께 보여드립니다."
                eyebrow="OUR PRINCIPLES"
                title={
                  <span className="single-line-desktop">
                    타협하지 않는 6가지 약속으로.
                  </span>
                }
              />
            </Reveal>
            <div className="principle-grid">
              {principles.map((principle, index) => (
                <Reveal
                  className="principle-item"
                  delay={index * 70}
                  key={principle.title}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{principle.title}</h3>
                    <p>{principle.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Reveal className="institution-reveal">
          <InstitutionStrip />
        </Reveal>

        <section className="section section-alt tone-notice">
          <div className="container">
            <Reveal className="section-topline">
              <SectionHeading
                description="서비스 변경과 중요한 안내를 투명하게 전합니다."
                eyebrow="NOTICE & DISCLOSURE"
                title="새로운 소식과 운영 안내"
              />
              <a className="desktop-link text-link" href="/notice">
                전체 보기 <span>↗</span>
              </a>
            </Reveal>
            <div className="notice-list">
              {notices.slice(0, 4).map((notice, index) => (
                <Reveal delay={index * 70} key={notice.title}>
                  <a className="notice-row" href="/notice">
                    <span className="notice-category">{notice.category}</span>
                    <strong>{notice.title}</strong>
                    <time>{notice.date}</time>
                    <span aria-hidden="true">↗</span>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section tone-faq">
          <div className="faq-preview container">
            <Reveal>
              <SectionHeading
                description={
                  <span className="single-line-desktop">
                    머니게이트와 머니로드를 이용하기 전에 궁금한 내용을
                    확인하세요.
                  </span>
                }
                eyebrow="FAQ"
                title="자주 묻는 질문"
              />
            </Reveal>
            <div>
              {faqs.slice(0, 5).map((faq, index) => (
                <Reveal delay={index * 60} key={faq.question}>
                  <a className="faq-link" href="/faq">
                    <span>Q</span>
                    <strong>{faq.question}</strong>
                    <span aria-hidden="true">+</span>
                  </a>
                </Reveal>
              ))}
              <a className="button button-ghost" href="/faq">
                질문 전체 보기
              </a>
            </div>
          </div>
        </section>

        <section className="section cta-section tone-cta">
          <Reveal className="cta-panel container">
            <div>
              <p className="eyebrow">LET&apos;S TALK</p>
              <h2>회사와 서비스에 대해 궁금한 점을 알려주세요.</h2>
            </div>
            <a className="button button-light" href="/contact">
              문의하기
            </a>
          </Reveal>
        </section>
      </main>
    </SiteShell>
  );
}
