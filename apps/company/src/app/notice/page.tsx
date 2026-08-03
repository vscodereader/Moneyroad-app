import type { Metadata } from "next";
import { PageHero } from "../components/page-hero";
import { Reveal } from "../components/reveal";
import { SiteShell } from "../components/site-shell";
import { notices } from "../content";

export const metadata: Metadata = {
  title: "공지사항",
  description: "머니게이트와 머니로드의 서비스 및 운영 안내입니다.",
};

export default function NoticePage() {
  return (
    <SiteShell>
      <main id="main-content">
        <PageHero
          description="서비스 변경, 점검, 데이터 상태와 운영정책을 투명하게 알려드립니다. 현재 목록은 디자인 확인용 예시입니다."
          eyebrow="NOTICE"
          title="새로운 소식과 중요한 안내"
          variant="notice"
        />
        <section className="section">
          <div className="container">
            <Reveal className="list-toolbar">
              <p>
                총 <strong>{notices.length}</strong>건
              </p>
              <span>예시 데이터</span>
            </Reveal>
            <div className="board-list">
              {notices.map((notice, index) => (
                <Reveal delay={index * 45} key={notice.title}>
                  <article className="board-row">
                    <span className="notice-category">{notice.category}</span>
                    <div>
                      <h2>{notice.title}</h2>
                      <p>{notice.summary}</p>
                    </div>
                    <time>{notice.date}</time>
                    <span aria-hidden="true" className="board-arrow">
                      ↗
                    </span>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
