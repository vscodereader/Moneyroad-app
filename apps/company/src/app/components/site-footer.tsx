import { navigation } from "../content";
import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top container">
        <div className="footer-brand">
          <Brand />
          <p>
            공개된 시장 정보를 이해하기 쉬운 맥락으로 정리해
            <br />
            투자자의 독립적인 판단을 돕습니다.
          </p>
        </div>
        <div className="footer-menus">
          {navigation.slice(0, 3).map((item) => (
            <div key={item.label}>
              <strong>{item.label}</strong>
              {item.children.map((child) => (
                <a href={child.href} key={child.label}>
                  {child.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="footer-company container">
        <p>
          주식회사 머니게이트 <span>대표이사 홍길동 (예시)</span>{" "}
          <span>사업자등록번호 000-00-00000 (예시)</span>
        </p>
        <p>
          서울특별시 OO구 OO로 000, 00층 (예시) <span>02-0000-0000</span>{" "}
          <span>contact@moneygate.co.kr</span>
        </p>
        <p>유사투자자문업 신고번호 제2026-000000호 (예시)</p>
      </div>
      <div className="legal-note container">
        <strong>투자 유의 안내</strong>
        <p>
          머니게이트는 불특정 다수를 대상으로 투자 참고 정보를 제공하며, 1:1
          투자자문 또는 투자일임 서비스를 제공하지 않습니다. 제공되는 정보는
          매매 권유나 수익 보장이 아니며 모든 투자에는 원금 손실 위험이
          있습니다. 최종 투자 판단과 책임은 이용자 본인에게 있습니다.
        </p>
      </div>
      <div className="footer-bottom container">
        <p>© 2026 MoneyGate. All rights reserved.</p>
        <div>
          <a href="/disclosure">이용약관</a>
          <a href="/disclosure">개인정보 처리방침</a>
          <a href="/contact">문의</a>
        </div>
      </div>
    </footer>
  );
}
