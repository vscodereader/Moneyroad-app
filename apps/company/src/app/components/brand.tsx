import Image from "next/image";

export function Brand() {
  return (
    <span className="brand">
      <Image
        alt=""
        aria-hidden="true"
        className="brand-mark"
        height="34"
        src="/icon.svg"
        width="34"
      />
      <span>머니게이트</span>
    </span>
  );
}
