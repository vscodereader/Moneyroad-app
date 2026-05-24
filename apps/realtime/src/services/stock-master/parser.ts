import { FIELDS_BY_MARKET, INTEGER_KEYS, type MarketType, PART1 } from "./spec";

export type StockMasterRow = Record<string, string | number | null> & {
  mkscShrnIscd: string;
  marketType: MarketType;
  stndIscd: string;
  htsKorIsnm: string;
};

const NEWLINE_RE = /\r?\n/;

function fieldsDataLen(market: MarketType): number {
  let sum = 0;
  for (const f of FIELDS_BY_MARKET[market]) {
    sum += f.w;
  }
  return sum;
}

function parseValue(raw: string, key: string): string | number | null {
  const value = raw.trim();
  if (value.length === 0) {
    return null;
  }
  if (INTEGER_KEYS.has(key)) {
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  return value;
}

/** Parses one CP949-decoded, newline-stripped master line into a row. */
export function parseMasterLine(
  line: string,
  market: MarketType
): StockMasterRow | null {
  const dataLen = fieldsDataLen(market);
  if (line.length <= dataLen + PART1.shortCode[1]) {
    return null;
  }

  const split = line.length - dataLen;
  const part1 = line.slice(0, split);
  const part2 = line.slice(split);

  const shortCode = part1.slice(PART1.shortCode[0], PART1.shortCode[1]).trim();
  if (!shortCode) {
    return null;
  }

  const row: StockMasterRow = {
    mkscShrnIscd: shortCode,
    marketType: market,
    stndIscd: part1.slice(PART1.stdCode[0], PART1.stdCode[1]).trim(),
    htsKorIsnm: part1.slice(PART1.stdCode[1]).trim(),
  };

  let offset = 0;
  for (const field of FIELDS_BY_MARKET[market]) {
    const chunk = part2.slice(offset, offset + field.w);
    offset += field.w;
    if (field.key) {
      row[field.key] = parseValue(chunk, field.key);
    }
  }

  return row;
}

/** Parses a full CP949-decoded master file into rows. */
export function parseMaster(
  text: string,
  market: MarketType
): StockMasterRow[] {
  const rows: StockMasterRow[] = [];
  for (const line of text.split(NEWLINE_RE)) {
    if (!line.trim()) {
      continue;
    }
    const row = parseMasterLine(line, market);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}
