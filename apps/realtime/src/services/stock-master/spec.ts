// KIS domestic stock master (.mst) layout.
//
// Source: KIS official examples `stocks_info/kis_kospi_code_mst.py` /
// `kis_kosdaq_code_mst.py`. Each line is CP949 text split into part1 (short
// code / standard code / Korean name) and a fixed-width part2 of flag/financial
// fields. The Python examples slice the trailing 228/222 *bytes* of a line that
// still has its newline; with newline-stripped lines the data width is one less
// (227 / 221), which equals the sum of the field widths below.

export const MASTER_SOURCES = {
  KOSPI: {
    url: "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
    entry: "kospi_code.mst",
  },
  KOSDAQ: {
    url: "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip",
    entry: "kosdaq_code.mst",
  },
} as const;

export type MarketType = keyof typeof MASTER_SOURCES;

/** part1 layout (chars), identical for both markets. */
export const PART1 = {
  shortCode: [0, 9], // mksc_shrn_iscd
  stdCode: [9, 21], // stnd_iscd
  // Korean name is part1.slice(21).
} as const;

/** A part2 field: char width and the stock_master column key (null = skip). */
export interface FieldSpec {
  key: string | null;
  w: number;
}

/** stock_master columns parsed as integers (others kept as trimmed strings). */
export const INTEGER_KEYS = new Set<string>([
  "stckSdpr",
  "frmlMrktDealQtyUnit",
  "ovtmMrktDealQtyUnit",
  "margRate",
  "crdtDays",
  "poPrc",
]);

// KOSPI part2: 70 fields, widths sum 227.
export const KOSPI_FIELDS: FieldSpec[] = [
  { w: 2, key: "scrtGrpClsCode" },
  { w: 1, key: "avlsScalClsCode" },
  { w: 4, key: "bstpLargDivCode" },
  { w: 4, key: "bstpMedmDivCode" },
  { w: 4, key: "bstpSmalDivCode" },
  { w: 1, key: "mninClsCodeYn" },
  { w: 1, key: "lowCurrentYn" },
  { w: 1, key: "sprnStrrNmixIssuYn" },
  { w: 1, key: "kospi200ApntClsCode" },
  { w: 1, key: "kospi100IssuYn" },
  { w: 1, key: "kospi50IssuYn" },
  { w: 1, key: "krxIssuYn" },
  { w: 1, key: "etpProdClsCode" },
  { w: 1, key: "elwPblcYn" },
  { w: 1, key: "krx100IssuYn" },
  { w: 1, key: "krxCarYn" },
  { w: 1, key: "krxSmcnYn" },
  { w: 1, key: "krxBioYn" },
  { w: 1, key: "krxBankYn" },
  { w: 1, key: "etprUndtObjtCoYn" },
  { w: 1, key: "krxEnrgChmsYn" },
  { w: 1, key: "krxStelYn" },
  { w: 1, key: "shortOverClsCode" },
  { w: 1, key: "krxMediCmncYn" },
  { w: 1, key: "krxCnstYn" },
  { w: 1, key: null }, // Non1 (filler)
  { w: 1, key: "krxScrtYn" },
  { w: 1, key: "krxShipYn" },
  { w: 1, key: "krxInsuYn" },
  { w: 1, key: "krxTrnpYn" },
  { w: 1, key: "sriNmixYn" },
  { w: 9, key: "stckSdpr" },
  { w: 5, key: "frmlMrktDealQtyUnit" },
  { w: 5, key: "ovtmMrktDealQtyUnit" },
  { w: 1, key: "trhtYn" },
  { w: 1, key: "sltrYn" },
  { w: 1, key: "mangIssuYn" },
  { w: 2, key: "mrktAlrmClsCode" },
  { w: 1, key: "mrktAlrmRiskAdntYn" },
  { w: 1, key: "insnPbntYn" },
  { w: 1, key: "bypsLstnYn" },
  { w: 2, key: "flngClsCode" },
  { w: 2, key: "fcamModClsCode" },
  { w: 2, key: "icicClsCode" },
  { w: 3, key: "margRate" },
  { w: 1, key: "crdtAble" },
  { w: 3, key: "crdtDays" },
  { w: 12, key: "prdyVol" },
  { w: 12, key: "stckFcam" },
  { w: 8, key: "stckLstnDate" },
  { w: 15, key: "lstnStcn" },
  { w: 21, key: "cpfn" },
  { w: 2, key: "stacMonth" },
  { w: 7, key: "poPrc" },
  { w: 1, key: "prstClsCode" },
  { w: 1, key: "sstsHotYn" },
  { w: 1, key: "stangeRunupYn" },
  { w: 1, key: "krx300IssuYn" },
  { w: 1, key: "kospiIssuYn" },
  { w: 9, key: "saleAccount" },
  { w: 9, key: "bsopPrfi" },
  { w: 9, key: "opPrfi" },
  { w: 5, key: "thtrNtin" },
  { w: 9, key: "roe" },
  { w: 8, key: "baseDate" },
  { w: 9, key: "prdyAvlsScal" },
  { w: 3, key: "grpCode" },
  { w: 1, key: "coCrdtLimtOverYn" },
  { w: 1, key: "secuLendAbleYn" },
  { w: 1, key: "stlnAbleYn" },
];

// KOSDAQ part2: 64 fields, widths sum 221.
export const KOSDAQ_FIELDS: FieldSpec[] = [
  { w: 2, key: "scrtGrpClsCode" },
  { w: 1, key: "avlsScalClsCode" },
  { w: 4, key: "bstpLargDivCode" },
  { w: 4, key: "bstpMedmDivCode" },
  { w: 4, key: "bstpSmalDivCode" },
  { w: 1, key: "vntrIssuYn" },
  { w: 1, key: "lowCurrentYn" },
  { w: 1, key: "krxIssuYn" },
  { w: 1, key: "etpProdClsCode" },
  { w: 1, key: "krx100IssuYn" },
  { w: 1, key: "krxCarYn" },
  { w: 1, key: "krxSmcnYn" },
  { w: 1, key: "krxBioYn" },
  { w: 1, key: "krxBankYn" },
  { w: 1, key: "etprUndtObjtCoYn" },
  { w: 1, key: "krxEnrgChmsYn" },
  { w: 1, key: "krxStelYn" },
  { w: 1, key: "shortOverClsCode" },
  { w: 1, key: "krxMediCmncYn" },
  { w: 1, key: "krxCnstYn" },
  { w: 1, key: "invtAlrmYn" },
  { w: 1, key: "krxScrtYn" },
  { w: 1, key: "krxShipYn" },
  { w: 1, key: "krxInsuYn" },
  { w: 1, key: "krxTrnpYn" },
  { w: 1, key: "ksq150NmixYn" },
  { w: 9, key: "stckSdpr" },
  { w: 5, key: "frmlMrktDealQtyUnit" },
  { w: 5, key: "ovtmMrktDealQtyUnit" },
  { w: 1, key: "trhtYn" },
  { w: 1, key: "sltrYn" },
  { w: 1, key: "mangIssuYn" },
  { w: 2, key: "mrktAlrmClsCode" },
  { w: 1, key: "mrktAlrmRiskAdntYn" },
  { w: 1, key: "insnPbntYn" },
  { w: 1, key: "bypsLstnYn" },
  { w: 2, key: "flngClsCode" },
  { w: 2, key: "fcamModClsCode" },
  { w: 2, key: "icicClsCode" },
  { w: 3, key: "margRate" },
  { w: 1, key: "crdtAble" },
  { w: 3, key: "crdtDays" },
  { w: 12, key: "prdyVol" },
  { w: 12, key: "stckFcam" },
  { w: 8, key: "stckLstnDate" },
  { w: 15, key: "lstnStcn" },
  { w: 21, key: "cpfn" },
  { w: 2, key: "stacMonth" },
  { w: 7, key: "poPrc" },
  { w: 1, key: "prstClsCode" },
  { w: 1, key: "sstsHotYn" },
  { w: 1, key: "stangeRunupYn" },
  { w: 1, key: "krx300IssuYn" },
  { w: 9, key: "saleAccount" },
  { w: 9, key: "bsopPrfi" },
  { w: 9, key: "opPrfi" },
  { w: 5, key: "thtrNtin" },
  { w: 9, key: "roe" },
  { w: 8, key: "baseDate" },
  { w: 9, key: "prdyAvlsScal" },
  { w: 3, key: "grpCode" },
  { w: 1, key: "coCrdtLimtOverYn" },
  { w: 1, key: "secuLendAbleYn" },
  { w: 1, key: "stlnAbleYn" },
];

export const FIELDS_BY_MARKET: Record<MarketType, FieldSpec[]> = {
  KOSPI: KOSPI_FIELDS,
  KOSDAQ: KOSDAQ_FIELDS,
};
