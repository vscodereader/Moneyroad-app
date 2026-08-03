import type { Metadata } from "next";
import { PageHero } from "../components/page-hero";
import { Reveal } from "../components/reveal";
import { SectionHeading } from "../components/section-heading";
import { SiteShell } from "../components/site-shell";
import { companyFacts, history, principles, team } from "../content";

export const metadata: Metadata = {
  title: "회사소개",
  description:
    "머니게이트의 미션, 대표 인사말, 회사 정보, 연혁과 조직을 소개합니다.",
};

export default function CompanyPage() {
  return (
    <SiteShell>
      <main id="main-content">
        <PageHero
          description={
            <span className="single-line-desktop">
              머니게이트는 누구나 치우침 없이 시장을 바라보고 스스로 판단할 수
              있는 힘을 기르도록 돕는 투명한 투자 길잡이입니다.
            </span>
          }
          eyebrow="ABOUT MONEYGATE"
          title="정보의 장벽을 넘어, 투자의 올바른 길을 엽니다"
          variant="company"
        />

        <section className="section" id="overview">
          <div className="mission-grid container">
            <Reveal className="mission-card mission-main">
              <p className="eyebrow">MISSION</p>
              <h2>
                <span className="title-line">가려진 정보는 투명하게,</span>
                <span className="title-line">투자의 시야는 명확하게</span>
              </h2>
              <p>
                소수에게 독점되던 정보의 격차를 해소하고, 누구나 데이터에 기반해
                합리적으로 사고할 수 있는 공정한 투자 환경을 조성합니다
              </p>
            </Reveal>
            <Reveal className="mission-card" delay={90}>
              <p className="eyebrow">VISION</p>
              <h3>
                <span className="title-line">흩어진 데이터는 하나로,</span>
                <span className="title-line">투자의 맥락은 선명하게</span>
              </h3>
              <p>
                쏟아지는 뉴스, 산발적인 시그널, 시시각각 변하는 가격. 흩어져
                있는 시장의 정보들을 하나의 매끄러운 흐름으로 연결해, 흔들리지
                않는 판단의 뼈대를 세워줍니다.
              </p>
            </Reveal>
            <Reveal className="mission-card" delay={180}>
              <p className="eyebrow">PROMISE</p>
              <h3>
                <span className="title-line">정답보다 근거를,</span>
                <span className="title-line">확신보다 투명성을</span>
              </h3>
              <p>
                시장에 완벽한 정답은 없습니다. 결과를 섣불리 단정 짓거나 헛된
                확신을 주지 않습니다. 데이터의 배경은 물론 그 한계까지 솔직하게
                공유하여 당신의 온전한 선택을 돕습니다.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section section-alt" id="message">
          <div className="message-layout container">
            <Reveal className="portrait-placeholder">
              <span>HG</span>
              <small>대표 이미지 예시</small>
            </Reveal>
            <Reveal className="message-copy" delay={120}>
              <p className="eyebrow">CEO MESSAGE · EXAMPLE</p>
              <h2>투자자가 스스로 판단할 수 있는 정보를 만들겠습니다.</h2>
              <p>안녕하세요. 머니게이트 대표이사 홍길동(예시)입니다.</p>
              <p>
                금융시장의 정보는 과거보다 훨씬 빠르게 생산되고 전달됩니다.
                그러나 정보가 많아졌다고 해서 판단이 쉬워진 것은 아닙니다. 서로
                다른 뉴스와 지표를 연결하고 지금 확인해야 할 내용을 구분하는
                일은 여전히 투자자 개인의 큰 부담입니다.
              </p>
              <p>
                머니게이트는 공개된 시장 정보와 데이터를 한곳에 모으고, 종목과
                시간의 흐름에 맞춰 정리하며, 이용자가 이해하기 쉬운 언어로
                전달하고자 합니다.
              </p>
              <p>
                우리는 이용자를 대신해 투자 결정을 내리지 않습니다. 특정한
                결과를 약속하지도 않습니다. 대신 정보가 어디에서 왔고 어떤
                의미를 가질 수 있으며 무엇을 주의해야 하는지 성실하게
                보여드리겠습니다.
              </p>
              <p className="signature">
                머니게이트 대표이사 <strong>홍길동 (예시)</strong>
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section">
          <div className="facts-layout container">
            <Reveal>
              <SectionHeading
                description="아래 내용은 디자인 확인을 위한 예시이며 실제 공개 전 회사 정보로 교체합니다."
                eyebrow="COMPANY PROFILE"
                title="회사 기본정보"
              />
            </Reveal>
            <Reveal className="facts-table" delay={100}>
              {companyFacts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="section section-alt" id="history">
          <div className="container">
            <Reveal>
              <SectionHeading
                description="실제 회사 연혁 확정 전까지 예시 데이터로 전체 구성을 보여드립니다."
                eyebrow="HISTORY"
                title="머니게이트가 걸어온 길"
              />
            </Reveal>
            <div className="timeline">
              {history.map(([date, title, badge], index) => (
                <Reveal
                  className="timeline-item"
                  delay={index * 55}
                  key={`${date}-${title}`}
                >
                  <time>{date}</time>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{title}</strong>
                    <small>{badge}</small>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="people">
          <div className="container">
            <Reveal>
              <SectionHeading
                description="제품, 데이터, 콘텐츠, 운영과 준법의 역할을 연결해 서비스를 만듭니다. 아래 인물은 모두 예시입니다."
                eyebrow="PEOPLE & ORGANIZATION"
                title="같은 원칙을 향해 움직이는 사람들"
              />
            </Reveal>
            <Reveal className="org-chart">
              <div className="org-head">대표이사</div>
              <div className="org-line" />
              <div className="org-branches">
                {[
                  "서비스·제품",
                  "데이터·리서치",
                  "운영·고객지원",
                  "준법·정보보호",
                ].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </Reveal>
            <div className="team-grid">
              {team.map((member, index) => (
                <Reveal
                  className="team-card"
                  delay={index * 60}
                  key={member.name}
                >
                  <span className="avatar">{member.initials}</span>
                  <div>
                    <h3>{member.name}</h3>
                    <p>{member.role}</p>
                    <small>{member.responsibility}</small>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-blueprint">
          <div className="container">
            <Reveal>
              <SectionHeading
                description="투자자 보호와 투명한 정보 제공을 모든 서비스의 기준으로 둡니다."
                eyebrow="OUR PRINCIPLES"
                title="운영 원칙"
              />
            </Reveal>
            <div className="principle-grid">
              {principles.map((principle, index) => (
                <Reveal
                  className="principle-item"
                  delay={index * 60}
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
      </main>
    </SiteShell>
  );
}
