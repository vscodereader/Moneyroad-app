import {
  boolean,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const stockMaster = pgTable(
  "stock_master",
  {
    /** 단축코드 (PK) */
    mkscShrnIscd: text("mksc_shrn_iscd").primaryKey(),
    /** 시장구분 KOSPI | KOSDAQ */
    marketType: text("market_type").notNull(),
    /** NXT 거래소 여부 */
    nxt: boolean("nxt").default(false).notNull(),
    /** 표준코드 */
    stndIscd: text("stnd_iscd").notNull().unique(),
    /** 한글종목명 */
    htsKorIsnm: text("hts_kor_isnm").notNull(),
    /** 증권그룹구분코드 (ST:주권 MF:증권투자회사 RT:부동산투자회사 등) */
    scrtGrpClsCode: char("scrt_grp_cls_code", { length: 2 }),
    /** 시가총액 규모 구분 코드 (KOSPI: 0제외/1대/2중/3소, KOSDAQ: 0제외/1KOSDAQ100/2mid300/3small) */
    avlsScalClsCode: char("avls_scal_cls_code", { length: 1 }),
    /** 지수업종 대분류 코드 */
    bstpLargDivCode: char("bstp_larg_div_code", { length: 4 }),
    /** 지수업종 중분류 코드 */
    bstpMedmDivCode: char("bstp_medm_div_code", { length: 4 }),
    /** 지수업종 소분류 코드 */
    bstpSmalDivCode: char("bstp_smal_div_code", { length: 4 }),

    // ── 코스피 전용 ──
    /** 제조업 구분 코드 (Y/N) - KOSPI only */
    mninClsCodeYn: char("mnin_cls_code_yn", { length: 1 }),
    /** 지배구조지수 종목 여부 (Y/N) - KOSPI only */
    sprnStrrNmixIssuYn: char("sprn_strr_nmix_issu_yn", { length: 1 }),
    /** KOSPI200 섹터업종 (0~9,A,B) - KOSPI only */
    kospi200ApntClsCode: char("kospi200_apnt_cls_code", { length: 1 }),
    /** KOSPI100 여부 - KOSPI only */
    kospi100IssuYn: char("kospi100_issu_yn", { length: 1 }),
    /** KOSPI50 종목 여부 - KOSPI only */
    kospi50IssuYn: char("kospi50_issu_yn", { length: 1 }),
    /** ELW 발행 여부 (Y/N) - KOSPI only */
    elwPblcYn: char("elw_pblc_yn", { length: 1 }),
    /** SRI 지수여부 (Y/N) - KOSPI only */
    sriNmixYn: char("sri_nmix_yn", { length: 1 }),
    /** KOSPI 여부 - KOSPI only */
    kospiIssuYn: char("kospi_issu_yn", { length: 1 }),

    // ── 코스닥 전용 ──
    /** 벤처기업 여부 (Y/N) - KOSDAQ only */
    vntrIssuYn: char("vntr_issu_yn", { length: 1 }),
    /** 투자주의환기종목 여부 - KOSDAQ only */
    invtAlrmYn: char("invt_alrm_yn", { length: 1 }),
    /** KOSDAQ150 지수여부 (Y/N) - KOSDAQ only */
    ksq150NmixYn: char("ksq150_nmix_yn", { length: 1 }),

    // ── 공통 필드 ──
    /** 저유동성종목 여부 */
    lowCurrentYn: char("low_current_yn", { length: 1 }),
    /** KRX 종목 여부 */
    krxIssuYn: char("krx_issu_yn", { length: 1 }),
    /** ETP 상품구분코드 (0:해당없음 1:투자회사형 2:수익증권형 3:ETN 4:손실제한ETN) */
    etpProdClsCode: char("etp_prod_cls_code", { length: 1 }),
    /** KRX100 종목 여부 (Y/N) */
    krx100IssuYn: char("krx100_issu_yn", { length: 1 }),
    /** KRX 자동차 여부 */
    krxCarYn: char("krx_car_yn", { length: 1 }),
    /** KRX 반도체 여부 */
    krxSmcnYn: char("krx_smcn_yn", { length: 1 }),
    /** KRX 바이오 여부 */
    krxBioYn: char("krx_bio_yn", { length: 1 }),
    /** KRX 은행 여부 */
    krxBankYn: char("krx_bank_yn", { length: 1 }),
    /** 기업인수목적회사여부 */
    etprUndtObjtCoYn: char("etpr_undt_objt_co_yn", { length: 1 }),
    /** KRX 에너지 화학 여부 */
    krxEnrgChmsYn: char("krx_enrg_chms_yn", { length: 1 }),
    /** KRX 철강 여부 */
    krxStelYn: char("krx_stel_yn", { length: 1 }),
    /** 단기과열종목구분코드 (0:해당없음 1:지정예고 2:지정 3:지정연장) */
    shortOverClsCode: char("short_over_cls_code", { length: 1 }),
    /** KRX 미디어 통신 여부 */
    krxMediCmncYn: char("krx_medi_cmnc_yn", { length: 1 }),
    /** KRX 건설 여부 */
    krxCnstYn: char("krx_cnst_yn", { length: 1 }),
    /** KRX 증권 구분 */
    krxScrtYn: char("krx_scrt_yn", { length: 1 }),
    /** KRX 선박 구분 */
    krxShipYn: char("krx_ship_yn", { length: 1 }),
    /** KRX섹터지수 보험여부 */
    krxInsuYn: char("krx_insu_yn", { length: 1 }),
    /** KRX섹터지수 운송여부 */
    krxTrnpYn: char("krx_trnp_yn", { length: 1 }),
    /** 주식 기준가 */
    stckSdpr: integer("stck_sdpr"),
    /** 정규 시장 매매 수량 단위 */
    frmlMrktDealQtyUnit: integer("frml_mrkt_deal_qty_unit"),
    /** 시간외 시장 매매 수량 단위 */
    ovtmMrktDealQtyUnit: integer("ovtm_mrkt_deal_qty_unit"),
    /** 거래정지 여부 */
    trhtYn: char("trht_yn", { length: 1 }),
    /** 정리매매 여부 */
    sltrYn: char("sltr_yn", { length: 1 }),
    /** 관리 종목 여부 */
    mangIssuYn: char("mang_issu_yn", { length: 1 }),
    /** 시장 경고 구분 코드 (00:해당없음 01:투자주의 02:투자경고 03:투자위험) */
    mrktAlrmClsCode: char("mrkt_alrm_cls_code", { length: 2 }),
    /** 시장 경고위험 예고 여부 */
    mrktAlrmRiskAdntYn: char("mrkt_alrm_risk_adnt_yn", { length: 1 }),
    /** 불성실 공시 여부 */
    insnPbntYn: char("insn_pbnt_yn", { length: 1 }),
    /** 우회 상장 여부 */
    bypsLstnYn: char("byps_lstn_yn", { length: 1 }),
    /** 락구분 코드 (00:해당없음 01:권리락 02:배당락 03:분배락 04:권배락 05:중간배당락 등) */
    flngClsCode: char("flng_cls_code", { length: 2 }),
    /** 액면가 변경 구분 코드 (00:해당없음 01:액면분할 02:액면병합 99:기타) */
    fcamModClsCode: char("fcam_mod_cls_code", { length: 2 }),
    /** 증자 구분 코드 (00:해당없음 01:유상증자 02:무상증자 03:유무상증자 99:기타) */
    icicClsCode: char("icic_cls_code", { length: 2 }),
    /** 증거금 비율 */
    margRate: integer("marg_rate"),
    /** 신용주문 가능 여부 */
    crdtAble: char("crdt_able", { length: 1 }),
    /** 신용기간 */
    crdtDays: integer("crdt_days"),
    /** 전일 거래량 */
    prdyVol: text("prdy_vol"),
    /** 주식 액면가 */
    stckFcam: text("stck_fcam"),
    /** 주식 상장 일자 */
    stckLstnDate: char("stck_lstn_date", { length: 8 }),
    /** 상장 주수(천) */
    lstnStcn: text("lstn_stcn"),
    /** 자본금 */
    cpfn: text("cpfn"),
    /** 결산 월 */
    stacMonth: char("stac_month", { length: 2 }),
    /** 공모 가격 */
    poPrc: integer("po_prc"),
    /** 우선주 구분 코드 (0:해당없음 1:구형우선주 2:신형우선주) */
    prstClsCode: char("prst_cls_code", { length: 1 }),
    /** 공매도과열종목여부 */
    sstsHotYn: char("ssts_hot_yn", { length: 1 }),
    /** 이상급등종목여부 */
    stangeRunupYn: char("stange_runup_yn", { length: 1 }),
    /** KRX300 종목 여부 (Y/N) */
    krx300IssuYn: char("krx300_issu_yn", { length: 1 }),
    /** 매출액 */
    saleAccount: text("sale_account"),
    /** 영업이익 */
    bsopPrfi: text("bsop_prfi"),
    /** 경상이익 */
    opPrfi: text("op_prfi"),
    /** 당기순이익 */
    thtrNtin: text("thtr_ntin"),
    /** ROE(자기자본이익률) */
    roe: text("roe"),
    /** 기준년월 */
    baseDate: char("base_date", { length: 8 }),
    /** 전일기준 시가총액 (억) */
    prdyAvlsScal: text("prdy_avls_scal"),
    /** 그룹사 코드 */
    grpCode: char("grp_code", { length: 3 }),
    /** 회사신용한도초과여부 */
    coCrdtLimtOverYn: char("co_crdt_limt_over_yn", { length: 1 }),
    /** 담보대출가능여부 */
    secuLendAbleYn: char("secu_lend_able_yn", { length: 1 }),
    /** 대주가능여부 */
    stlnAbleYn: char("stln_able_yn", { length: 1 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("stock_master_market_type_idx").on(table.marketType),
    uniqueIndex("stock_master_stnd_iscd_idx").on(table.stndIscd),
    index("stock_master_hts_kor_isnm_idx").on(table.htsKorIsnm),
  ]
);
