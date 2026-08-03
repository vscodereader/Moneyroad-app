import type { Metadata } from "next";
import { PageHero } from "../components/page-hero";
import { Reveal } from "../components/reveal";
import { SiteShell } from "../components/site-shell";
import { disclosures } from "../content";

export const metadata: Metadata = {
  title: "법적 고지·공시",
  description: "머니게이트의 사업 범위와 투자정보 이용 시 유의사항입니다.",
};

export default function DisclosurePage() {
  return (
    <SiteShell>
      <main id="main-content">
        <PageHero
          description="회사의 사업자·신고 정보, 제공 서비스의 범위와 투자정보 이용 시 주의사항을 확인하세요."
          eyebrow="DISCLOSURE & LEGAL"
          title="범위와 한계를 분명하게 안내합니다."
          variant="disclosure"
        />
        <section className="section">
          <div className="disclosure-grid container">
            {disclosures.map((item, index) => (
              <Reveal
                className="disclosure-card"
                delay={index * 60}
                key={item.title}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <small>{item.type}</small>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <button type="button">
                  내용 보기 <i>↗</i>
                </button>
              </Reveal>
            ))}
          </div>
        </section>
        <section className="section section-alt">
          <Reveal className="legal-large container">
            <p className="eyebrow">INVESTMENT RISK</p>
            <h2 className="single-line-desktop">
              투자정보 이용 시 반드시 확인하세요.
            </h2>
            <div className="legal-columns">
              <p>
                머니게이트는 불특정 다수에게 투자 참고 정보를 제공하는
                유사투자자문업자이며, 정식 투자자문업·투자일임업자가 아닙니다.
                1:1 개별 자문과 고객 자산 운용을 제공하지 않습니다.
              </p>
              <p>
                모든 투자에는 원금 손실 위험이 있습니다. 뉴스, 요약, 시그널과
                토론 내용은 미래 수익을 보장하지 않으며 최종 투자 판단과 그
                결과에 대한 책임은 이용자 본인에게 있습니다.
              </p>
            </div>
          </Reveal>
        </section>
      </main>
    </SiteShell>
  );
}
