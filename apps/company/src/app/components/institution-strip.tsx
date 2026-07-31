import Image from "next/image";

const institutions = [
  { src: "/logo-fss.png", label: "금융감독원", width: 356, height: 103 },
  { src: "/logo-nts.png", label: "국세청", width: 112, height: 44 },
  { src: "/logo-sgi.png", label: "SGI서울보증", width: 180, height: 36 },
  { src: "/logo-kba.png", label: "대한변호사협회", width: 227, height: 140 },
] as const;

export function InstitutionStrip() {
  return (
    <div className="institution-section">
      <div className="institution-strip container">
        {institutions.map((institution) => (
          <div className="institution-logo" key={institution.label}>
            <Image
              alt={`${institution.label} 로고`}
              height={institution.height}
              src={institution.src}
              width={institution.width}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
