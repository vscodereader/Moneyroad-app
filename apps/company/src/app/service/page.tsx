import type { Metadata } from "next";
import { PageHero } from "../components/page-hero";
import { Reveal } from "../components/reveal";
import { SectionHeading } from "../components/section-heading";
import { SiteShell } from "../components/site-shell";
import { businessAreas, processSteps } from "../content";

export const metadata: Metadata = {
  title: "사업·서비스",
  description:
    "머니게이트의 투자정보 콘텐츠, 시장 데이터·시그널, 리서치·교육 사업을 소개합니다.",
};

const serviceDetails = [
  {
    id: "information",
    label: "01",
    title: "투자정보 콘텐츠",
    headline: ["노이즈를 걷어낸 핵심, 맥락이 살아있는 투자 정보"],
    body: [
      "수많은 매체의 중복된 뉴스는 걸러내고, 흩어진 소식들을 종목과 테마 단위로 엮어냅니다.",
      "방대한 기사와 복잡한 이슈도 '머니로드 요약'을 통해 가장 중요한 핵심만 빠르게 짚어드립니다.",
    ],
    items: [
      "국내외 시장 주요 뉴스",
      "종목·산업 이벤트",
      "공시·정책 변화",
      "투자 기초 콘텐츠",
    ],
    value: {
      title: "낭비되는 시간을 줄이고, 시장의 큰 그림을 읽다",
      description:
        "정보 탐색에 드는 피로도를 획기적으로 낮추고, 단편적인 기사 이면에 숨겨진 진짜 맥락을 파악할 수 있습니다.",
    },
    limit: {
      title: "단편적 정보로 수익을 호도하지 않습니다",
      description:
        "개별 뉴스나 기사 하나만을 근거로 무리한 매수를 권유하거나 특정 종목의 수익을 약속하지 않습니다.",
    },
  },
  {
    id: "signal",
    label: "02",
    title: "시장 데이터·시그널",
    headline: ["데이터가 보내는 신호, 투명하게 밝히는 그 근거"],
    body: [
      "시장의 미세한 가격 변동과 거래량 변화를 감지해 직관적인 시그널로 시각화합니다.",
      "단순히 '결과'만 던져주는 것이 아니라, 그 신호가 발생한 명확한 데이터적 '근거'를 반드시 함께 제시합니다.",
    ],
    items: [
      "가격·거래량",
      "기술적 지표",
      "뉴스·공시 이벤트",
      "매수·매도·관망 시그널",
    ],
    value: {
      title: "결정적 타이밍을 포착하는 데이터 나침반",
      description:
        "관심 종목에서 유의미한 움직임이 나타났을 때 가장 먼저 감지하고, 다음 투자 액션을 준비하는 객관적 지표로 활용할 수 있습니다.",
    },
    limit: {
      title: "맹목적인 매매 지표가 아닙니다",
      description:
        "시그널은 참고용 데이터일 뿐, 기계적인 매매 지시나 미래의 확정적 수익을 의미하지 않습니다.",
    },
  },
  {
    id: "research",
    label: "03",
    title: "리서치·교육",
    headline: ["누구에게도 의존하지 않는 나만의 투자 안목"],
    body: [
      "종목을 '찍어주는' 대신, 시장을 스스로 읽어내는 방법을 공유합니다.",
      "진입 장벽이 높은 금융 용어와 복잡한 데이터 지표들을 누구나 이해할 수 있는 일상의 언어로 명쾌하게 번역해 드립니다.",
    ],
    items: [
      "시장·산업 기본 관점",
      "지표와 시그널 해설",
      "뉴스·공시 확인법",
      "투자 위험과 손실 가능성",
    ],
    value: {
      title: "흔들리지 않는 판단의 자립",
      description:
        "타인의 의견에 휩쓸리지 않고, 스스로 정보의 진위와 리스크를 가려내는 단단한 투자 근력을 길러줍니다.",
    },
    limit: {
      title: "개인 맞춤형 투자 자문은 진행하지 않습니다",
      description:
        "불특정 다수를 위한 객관적 교육 콘텐츠이며, 개인의 자산이나 소득 상황을 반영한 1:1 맞춤형 포트폴리오를 제공하지 않습니다.",
    },
  },
] as const;

export default function ServicePage() {
  return (
    <SiteShell>
      <main id="main-content">
        <PageHero
          description="시장 정보를 찾고, 맥락을 해석하고, 스스로 검증해 내기까지. 성공적인 투자를 완성하는 모든 과정에 가장 단단한 기반을 제공합니다."
          eyebrow="BUSINESS & SERVICE"
          title="파편화된 정보의 발견이, 온전한 당신의 이해가 되도록"
          variant="service"
        />

        <section className="section service-index">
          <div className="card-grid three container">
            {businessAreas.map((area, index) => (
              <Reveal
                className="feature-card"
                delay={index * 90}
                key={area.title}
              >
                <div aria-hidden="true" className="card-icon">
                  0{index + 1}
                </div>
                <h2>{area.title}</h2>
                <p>{area.description}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {serviceDetails.map((service, index) => (
          <section
            className={`section service-detail ${index % 2 ? "" : "section-alt"}`}
            id={service.id}
            key={service.id}
          >
            <div className="service-detail-grid container">
              <Reveal className="service-number">
                <span>{service.label}</span>
                <small>{service.title}</small>
              </Reveal>
              <Reveal className="service-detail-copy" delay={100}>
                <p className="eyebrow">{service.title}</p>
                <h2>
                  {service.headline.map((line) => (
                    <span className="title-line" key={line}>
                      {line}
                    </span>
                  ))}
                </h2>
                <p className="section-lead">
                  {service.body.map((line) => (
                    <span className="service-copy-line" key={line}>
                      {line}
                    </span>
                  ))}
                </p>
                <div className="tag-list">
                  {service.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div className="value-limit">
                  <div className="value-card">
                    <div className="value-limit-label">
                      <small>VALUE</small>
                      <span>당신이 얻게 될 가치</span>
                    </div>
                    <h3>{service.value.title}</h3>
                    <p>{service.value.description}</p>
                  </div>
                  <div className="boundary-card">
                    <div className="value-limit-label">
                      <small>BOUNDARY</small>
                      <span>우리의 명확한 한계</span>
                    </div>
                    <h3>{service.limit.title}</h3>
                    <p>{service.limit.description}</p>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        ))}

        <section className="section section-blueprint" id="process">
          <div className="container">
            <Reveal>
              <SectionHeading
                description="쏟아지는 데이터를 그대로 전달하지 않습니다. 8단계의 깐깐한 검증과 정제 과정을 거쳐 가장 신뢰할 수 있는 정보만 남깁니다."
                eyebrow="INFORMATION FLOW"
                title="노이즈는 거르고, 인사이트는 정제하다"
              />
            </Reveal>
            <div className="process-flow">
              {[processSteps.slice(0, 4), processSteps.slice(4, 8)].map(
                (row, rowIndex) => {
                  const displayRow = rowIndex === 0 ? row : [...row].reverse();

                  return (
                    <div
                      className={`process-flow-group ${rowIndex === 1 ? "process-flow-return" : ""}`}
                      key={`flow-${row.map((step) => step.number).join("-")}`}
                    >
                      <div className="process-flow-row">
                        {displayRow.map((step, stepIndex) => {
                          const index = Number(step.number) - 1;
                          return (
                            <div
                              className="process-flow-unit"
                              key={step.number}
                            >
                              <Reveal className="flow-step" delay={index * 120}>
                                <span className="process-number">
                                  {step.number}
                                </span>
                                <h3>{step.title}</h3>
                                <p>{step.description}</p>
                              </Reveal>
                              {stepIndex < displayRow.length - 1 ? (
                                <Reveal
                                  className="flow-arrow"
                                  delay={
                                    rowIndex === 0
                                      ? index * 120 + 70
                                      : (index - 1) * 120 + 70
                                  }
                                >
                                  <span aria-hidden="true">
                                    {rowIndex === 0 ? "→" : "←"}
                                  </span>
                                </Reveal>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {rowIndex === 0 ? (
                        <Reveal className="flow-bridge" delay={550}>
                          <span aria-hidden="true">↓</span>
                        </Reveal>
                      ) : null}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </section>

        <section className="section cta-section">
          <Reveal className="cta-panel container">
            <div>
              <p className="eyebrow">MONEYROAD</p>
              <h2>서비스가 실제로 연결되는 방식을 확인하세요.</h2>
            </div>
            <a className="button button-light" href="https://moneyroad.ai.kr/">
              머니로드 보기
            </a>
          </Reveal>
        </section>
      </main>
    </SiteShell>
  );
}
