import Image from "next/image";

export function MoneyroadMockup() {
  return (
    <div className="phone-stage">
      <div className="phone phone-back">
        <Image
          alt="머니로드 뉴스 화면"
          height={2688}
          priority
          src="/moneyroad-news.png"
          width={1242}
        />
      </div>
      <div className="phone phone-front">
        <Image
          alt="머니로드 종목 상세 화면"
          height={2688}
          priority
          src="/moneyroad-stock.png"
          width={1242}
        />
      </div>
      <div aria-hidden="true" className="phone-stage-glow" />
    </div>
  );
}
