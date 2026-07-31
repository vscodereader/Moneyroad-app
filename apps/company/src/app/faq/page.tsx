import type { Metadata } from "next";
import { FaqAccordion } from "../components/faq-accordion";
import { PageHero } from "../components/page-hero";
import { Reveal } from "../components/reveal";
import { SiteShell } from "../components/site-shell";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: "머니게이트와 머니로드에 관한 자주 묻는 질문입니다.",
};

export default function FaqPage() {
  return (
    <SiteShell>
      <main id="main-content">
        <PageHero
          description="회사와 신고, 투자정보의 범위, 머니로드 기능, 토론과 문의에 관한 24개 답변을 준비했습니다."
          eyebrow="FREQUENTLY ASKED QUESTIONS"
          title="궁금한 내용을 먼저 확인하세요."
          variant="faq"
        />
        <section className="section">
          <div className="faq-page-layout container">
            <Reveal className="faq-side">
              <p className="eyebrow">24 QUESTIONS</p>
              <h2>답을 찾지 못하셨나요?</h2>
              <p>
                종목에 대한 1:1 투자 상담은 제공하지 않지만 서비스, 데이터
                오류와 회사 정보는 공식 문의처로 확인할 수 있습니다.
              </p>
              <a className="button button-primary" href="/contact">
                문의하기
              </a>
            </Reveal>
            <Reveal className="faq-content" delay={100}>
              <FaqAccordion />
            </Reveal>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
