import type { Metadata } from "next";
import { PageHero } from "../components/page-hero";
import { Reveal } from "../components/reveal";
import { SiteShell } from "../components/site-shell";
import { contactTypes } from "../content";

export const metadata: Metadata = {
  title: "문의·오시는 길",
  description: "머니게이트 공식 연락처와 문의 유형, 오시는 길입니다.",
};

export default function ContactPage() {
  return (
    <SiteShell>
      <main id="main-content">
        <PageHero
          description="서비스 이용, 데이터 오류, 제휴, 보도와 회사 정보에 관한 문의를 공식 연락처로 전달해 주세요."
          eyebrow="CONTACT"
          title="궁금한 내용을 알려주세요."
          variant="contact"
        />

        <section className="section contact-info-section">
          <div className="contact-card-grid container">
            {[
              ["01", "PHONE", "고객센터", "02-0000-0000", "평일 09:00 - 18:00"],
              [
                "02",
                "E-MAIL",
                "서비스 및 일반 문의",
                "contact@moneygate.co.kr",
                "머니게이트 이용 및 회사 관련 내용",
              ],
              [
                "03",
                "PRIVACY",
                "개인정보 보호 전담",
                "privacy@moneygate.co.kr",
                "개인정보 열람, 정정 및 삭제 요청",
              ],
            ].map(([number, label, title, value, note], index) => (
              <Reveal className="contact-card" delay={index * 90} key={label}>
                <span className="contact-card-number">{number}</span>
                <div className="contact-card-content">
                  <div className="contact-card-heading">
                    <small>{label}</small>
                    <i aria-hidden="true">|</i>
                    <h2>{title}</h2>
                  </div>
                  <p className="contact-card-detail">
                    <strong>{value}</strong>
                    <span>({note})</span>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section section-alt">
          <div className="contact-type-layout container">
            <Reveal className="contact-type-intro">
              <p className="eyebrow">INQUIRY TYPE</p>
              <h2 className="display-title">무엇을 도와드릴까요?</h2>
              <p>
                <span>도움이 필요한 주제를 선택해 주세요.</span>
                <span>
                  담당 부서로 바로 연결되어 가장 신속하고 정확한 안내를 받으실
                  수 있습니다.
                </span>
              </p>
            </Reveal>
            <div className="contact-type-grid">
              {contactTypes.map(([title, description], index) => (
                <Reveal className="contact-type" delay={index * 50} key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <i aria-hidden="true">↗</i>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="location-grid container">
            <Reveal className="map-placeholder">
              <div aria-hidden="true" className="map-grid" />
              <span aria-hidden="true" className="map-pin" />
              <p>실제 주소 확정 후 지도 연결</p>
            </Reveal>
            <Reveal className="location-copy" delay={120}>
              <p className="eyebrow">LOCATION</p>
              <h2>오시는 길</h2>
              <dl>
                <div>
                  <dt>주소</dt>
                  <dd>서울특별시 OO구 OO로 000, 00층 (예시)</dd>
                </div>
                <div>
                  <dt>지하철</dt>
                  <dd>OO역 0번 출구에서 도보 0분 (예시)</dd>
                </div>
                <div>
                  <dt>버스</dt>
                  <dd>OO정류장 하차 후 도보 0분 (예시)</dd>
                </div>
                <div>
                  <dt>주차</dt>
                  <dd>방문자 주차 가능 여부 확인 필요 (예시)</dd>
                </div>
                <div>
                  <dt>방문</dt>
                  <dd>방문 전 대표 연락처로 일정을 확인해 주세요.</dd>
                </div>
              </dl>
              <button className="button button-ghost" disabled type="button">
                주소 확정 후 지도 보기
              </button>
            </Reveal>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
