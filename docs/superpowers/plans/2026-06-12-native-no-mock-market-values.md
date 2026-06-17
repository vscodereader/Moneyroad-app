# Native No Mock Market Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `apps/native` from showing mock market values as if they were live price, change, chart, index, or current-price-derived data.

**Architecture:** Keep local stock metadata for names, codes, sectors, and logos, but remove market-value fallback paths from screens and shared cards. Live/realtime data remains the only source for price-like numbers; missing data renders explicit UI states.

**Tech Stack:** Expo Router, React Native, TanStack Query, Zustand quote store, `react-native-sse`, oRPC, Ultracite/Biome.

---

## File Structure

- Modify: `apps/native/src/hooks/use-index-stream.ts`
  - Remove static index value fallback from the hook API and return nullable market values.
- Modify: `apps/native/src/components/cards.tsx`
  - Render index loading states and remove stock price/sparkline fallback from shared cards.
- Modify: `apps/native/src/screens/home/index.tsx`
  - Stop importing `indices` from `utils/data`.
- Modify: `apps/native/src/screens/stock-detail/index.tsx`
  - Remove `stocks[0]` fallback and show a not-found state for unknown stock codes.
  - Show quote loading state instead of `0원`.
- Modify: `apps/native/src/screens/settings/price-alert-new.tsx`
  - Remove mock current price usage and keep direct target input only.
- Modify: `apps/native/src/screens/settings/pages.tsx`
  - Remove mock current-price diff from existing price alerts.
- Modify: `apps/native/src/screens/search/index.tsx`
  - Remove mock price/change display from static search and trending rows.
- Modify: `apps/native/src/screens/news/index.tsx`
  - Remove mock stock snapshot price/change/score from the news detail sheet.

---

### Task 1: Home Index Strip Uses Explicit Loading State

**Files:**
- Modify: `apps/native/src/hooks/use-index-stream.ts`
- Modify: `apps/native/src/components/cards.tsx`
- Modify: `apps/native/src/screens/home/index.tsx`

- [ ] **Step 1: Run baseline search to expose static index fallback**

Run:

```bash
rg -n "indices as fallbackIndices|useIndexStream\\(fallbackIndices\\)|export function useIndexStream\\(fallback" apps/native/src/hooks/use-index-stream.ts apps/native/src/screens/home/index.tsx
```

Expected before implementation: matches in `home/index.tsx` and `use-index-stream.ts`.

- [ ] **Step 2: Change `LiveIndex` to nullable market values**

In `apps/native/src/hooks/use-index-stream.ts`, remove the `MarketIndex` import:

```ts
-import type { MarketIndex } from "@/utils/data";
```

Replace the `LiveIndex` interface and hook signature with:

```ts
export interface LiveIndex {
  change: number | null;
  changePct: number | null;
  name: string;
  prevClose: number | null;
  series: IndexPoint[];
  value: number | null;
}

export function useIndexStream(): LiveIndex[] {
```

Replace the final `return INDEX_DEFS.map(...)` block with:

```ts
  return INDEX_DEFS.map(({ code, name }) => {
    const lv = live[code];
    if (!(lv && lv.value > 0 && lv.prevClose > 0)) {
      return {
        name,
        value: null,
        change: null,
        changePct: null,
        prevClose: null,
        series: [],
      };
    }
    const series = Object.entries(lv.byMinute)
      .map(([m, v]) => ({ m: Number(m), v }))
      .sort((a, b) => a.m - b.m);
    const change = lv.value - lv.prevClose;
    const changePct = (change / lv.prevClose) * 100;
    return {
      name,
      value: lv.value,
      change,
      changePct,
      prevClose: lv.prevClose,
      series,
    };
  });
}
```

Also update `applySeed` inside the same file so a seed point of `0` is not treated as absent:

```ts
value: cur?.value ?? (s.points.at(-1)?.v ?? 0),
```

- [ ] **Step 3: Update `IndexStrip` rendering**

In `apps/native/src/components/cards.tsx`, inside `IndexStrip`, derive a `hasValue` boolean inside the `indices.map` callback:

```tsx
      {indices.map((idx) => {
        const hasValue =
          idx.value !== null &&
          idx.change !== null &&
          idx.changePct !== null &&
          idx.prevClose !== null;
        return (
```

Close the callback with `); })}` instead of the current direct `))}`.

Replace the chart, value, and change render blocks in each index cell with:

```tsx
            {hasValue ? (
              <IndexIntradayChart
                height={20}
                prevClose={idx.prevClose}
                series={idx.series}
                sessionMinutes={SESSION_MINUTES}
                t={t}
                width={56}
              />
            ) : (
              <Skeleton height={20} radius={4} width={56} />
            )}
```

```tsx
          <Text style={{ fontSize: 17, fontWeight: "800", color: t.fgStrong }}>
            {hasValue ? fmt.indexValue(idx.value) : "시세 연결 중"}
          </Text>
          {hasValue ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: changeColor(idx.change, t),
              }}
            >
              {fmt.signedNum(idx.change)} ({fmt.pct(idx.changePct)})
            </Text>
          ) : (
            <Text style={{ color: t.fgSubtle, fontSize: 12, fontWeight: "700" }}>
              지수 데이터를 기다리고 있어요
            </Text>
          )}
```

- [ ] **Step 4: Remove home fallback import and call**

In `apps/native/src/screens/home/index.tsx`, remove:

```ts
import { indices as fallbackIndices } from "@/utils/data";
```

Change:

```ts
const indices = useIndexStream(fallbackIndices);
```

to:

```ts
const indices = useIndexStream();
```

- [ ] **Step 5: Verify index fallback is gone**

Run:

```bash
rg -n "indices as fallbackIndices|useIndexStream\\(fallbackIndices\\)|export function useIndexStream\\(fallback" apps/native/src/hooks/use-index-stream.ts apps/native/src/screens/home/index.tsx
```

Expected after implementation: no matches.

- [ ] **Step 6: Commit task**

```bash
git add apps/native/src/hooks/use-index-stream.ts apps/native/src/components/cards.tsx apps/native/src/screens/home/index.tsx
git commit -m "fix: 네이티브 홈 지수 mock 폴백 제거" -m "- 정적 KOSPI/KOSDAQ 값을 홈 지수 기본값으로 사용하지 않도록 수정" -m "- 실시간 지수 데이터가 없을 때 연결 중 상태를 표시" -m "- useIndexStream 반환값에 데이터 부재 상태를 명시"
```

---

### Task 2: Shared Stock Cards Stop Falling Back to Mock Prices and Charts

**Files:**
- Modify: `apps/native/src/components/cards.tsx`

- [ ] **Step 1: Run baseline search for shared mock market values**

Run:

```bash
rg -n "stock\\.price|stock\\.change|stock\\.changePct|stock\\.spark" apps/native/src/components/cards.tsx
```

Expected before implementation: matches in `StockRow` and `SignalStockRow`.

- [ ] **Step 2: Update `StockRow` to use live quote only**

In `apps/native/src/components/cards.tsx`, replace the top of `StockRow` after `const { t } = useMrTheme();` with:

```ts
  const live = useLiveQuote(stock.code);
  const spark = useStockSparkline(stock.code);
  const hasSpark = spark.length > 1;
```

Replace the right-side market value block in `StockRow` with:

```tsx
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {hasSpark && live ? (
          <Sparkline
            data={spark}
            height={22}
            positive={live.change > 0}
            t={t}
            width={64}
          />
        ) : (
          <Skeleton height={22} radius={4} width={64} />
        )}
        {live ? (
          <>
            <Text style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}>
              {fmt.price(live.price)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: changeColor(live.change, t),
              }}
            >
              {fmt.pct(live.changeRate)}
            </Text>
          </>
        ) : (
          <Text style={{ color: t.fgSubtle, fontSize: 11, fontWeight: "700" }}>
            시세 연결 중
          </Text>
        )}
      </View>
```

- [ ] **Step 3: Update `SignalStockRow` to use live quote only**

In `SignalStockRow`, replace:

```ts
  const price = live?.price ?? stock.price;
  const change = live?.change ?? stock.change;
  const changePct = live?.changeRate ?? stock.changePct;
  const spark = useStockSparkline(stock.code);
  const sparkData = spark.length > 1 ? spark : stock.spark;
```

with:

```ts
  const spark = useStockSparkline(stock.code);
  const hasSpark = spark.length > 1;
```

Replace the market metadata `<Text>` below `{stock.name}` with:

```tsx
        {live ? (
          <Text style={{ fontSize: 11, color: t.fgMuted }}>
            {fmt.price(live.price)}원 ·{" "}
            <Text style={{ color: changeColor(live.change, t) }}>
              {fmt.pct(live.changeRate)}
            </Text>
          </Text>
        ) : (
          <Text style={{ fontSize: 11, color: t.fgSubtle }}>
            시세 연결 중
          </Text>
        )}
```

Replace the `Sparkline` call in `SignalStockRow` with:

```tsx
      {hasSpark && live ? (
        <Sparkline
          data={spark}
          height={22}
          positive={live.change > 0}
          t={t}
          width={56}
        />
      ) : (
        <Skeleton height={22} radius={4} width={56} />
      )}
```

- [ ] **Step 4: Verify shared card mock market fallback is gone**

Run:

```bash
rg -n "stock\\.price|stock\\.change|stock\\.changePct|stock\\.spark" apps/native/src/components/cards.tsx
```

Expected after implementation: no matches.

- [ ] **Step 5: Commit task**

```bash
git add apps/native/src/components/cards.tsx
git commit -m "fix: 네이티브 공용 카드 시세 mock 폴백 제거" -m "- StockRow와 SignalStockRow에서 mock 가격과 등락률 사용을 제거" -m "- live quote가 없을 때 시세 연결 중 상태를 표시" -m "- mock sparkline 대신 skeleton 상태를 렌더링"
```

---

### Task 3: Stock Detail Handles Unknown Codes and Quote Absence

**Files:**
- Modify: `apps/native/src/screens/stock-detail/index.tsx`

- [ ] **Step 1: Run baseline search for detail fallback**

Run:

```bash
rg -n "stocks\\[0\\]|live\\?\\.price \\?\\? 0|live\\?\\.change \\?\\? 0|live\\?\\.changeRate \\?\\? 0" apps/native/src/screens/stock-detail/index.tsx
```

Expected before implementation: matches for `stocks[0]` and `0` quote fallback.

- [ ] **Step 2: Change imports**

In `apps/native/src/screens/stock-detail/index.tsx`, change:

```ts
import { useLiveQuote } from "@/hooks/use-live-quotes";
```

to:

```ts
import { type LiveQuote, useLiveQuote } from "@/hooks/use-live-quotes";
```

Change:

```ts
import { findStock, stocks } from "@/utils/data";
```

to:

```ts
import { findStock, type Stock } from "@/utils/data";
```

- [ ] **Step 3: Add quote and not-found components**

Add these helpers above `export default function StockDetailScreen()`:

```tsx
function QuoteSummary({
  live,
  t,
}: {
  live: LiveQuote | undefined;
  t: MrTokens;
}) {
  if (!live) {
    return (
      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: t.fgStrong,
            fontSize: 24,
            fontWeight: "800",
          }}
        >
          시세 연결 중
        </Text>
        <Text style={{ color: t.fgSubtle, fontSize: 13 }}>
          실시간 시세를 기다리고 있어요.
        </Text>
      </View>
    );
  }
  return (
    <>
      <Text
        style={{
          fontSize: 34,
          fontWeight: "800",
          letterSpacing: -0.5,
          color: t.fgStrong,
        }}
      >
        {fmt.price(live.price)}
        <Text style={{ fontSize: 16, fontWeight: "600", color: t.fgMuted }}>
          {" "}
          원
        </Text>
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: changeColor(live.change, t),
          }}
        >
          {fmt.signedNum(live.change)} ({fmt.pct(live.changeRate)})
        </Text>
        <Text style={{ fontSize: 12, color: t.fgSubtle, fontWeight: "500" }}>
          오늘
        </Text>
      </View>
    </>
  );
}

function StockNotFoundView() {
  const { t } = useMrTheme();
  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
        title="종목 정보"
      />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Icon.alert color={t.fgSubtle} size={32} />
        <Text
          style={{
            color: t.fgStrong,
            fontSize: 15,
            fontWeight: "800",
            marginTop: 12,
            textAlign: "center",
          }}
        >
          종목 정보를 찾을 수 없습니다
        </Text>
        <Text
          style={{
            color: t.fgMuted,
            fontSize: 13,
            lineHeight: 20,
            marginTop: 6,
            textAlign: "center",
          }}
        >
          검색이나 관심 종목에서 다시 선택해 주세요.
        </Text>
      </View>
    </MrScreen>
  );
}
```

- [ ] **Step 4: Rename the existing component and add a wrapper**

Change the existing component declaration from:

```tsx
export default function StockDetailScreen() {
```

to:

```tsx
function StockDetailContent({ stock }: { stock: Stock }) {
```

Then remove these lines from the top of the renamed component:

```ts
  const { code } = useLocalSearchParams<{ code: string }>();
  const stock = findStock(code) ?? stocks[0];
```

Add this wrapper directly above `function StockDetailContent`:

```tsx
export default function StockDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const stock = code ? findStock(code) : undefined;
  if (!stock) {
    return <StockNotFoundView />;
  }
  return <StockDetailContent stock={stock} />;
}
```

Keep these existing hook lines inside `StockDetailContent`:

```ts
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const meta = signalMeta(t);
```

- [ ] **Step 5: Remove numeric quote fallback in detail content**

In `StockDetailContent`, replace:

```ts
  // Show 0 until a live tick arrives — the static stock metadata is seed data
  // and would be mistaken for a real price otherwise.
  const live = useLiveQuote(stock.code);
  const price = live?.price ?? 0;
  const change = live?.change ?? 0;
  const changePct = live?.changeRate ?? 0;
  const up = change > 0;
```

with:

```ts
  const live = useLiveQuote(stock.code);
  const up = (live?.change ?? 0) > 0;
```

Replace the entire JSX price block under `{/* Price */}` with:

```tsx
        {/* Price */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <QuoteSummary live={live} t={t} />
        </View>
```

- [ ] **Step 6: Verify stock detail fallback is gone**

Run:

```bash
rg -n "stocks\\[0\\]|live\\?\\.price \\?\\? 0|live\\?\\.change \\?\\? 0|live\\?\\.changeRate \\?\\? 0" apps/native/src/screens/stock-detail/index.tsx
```

Expected after implementation: no matches.

- [ ] **Step 7: Commit task**

```bash
git add apps/native/src/screens/stock-detail/index.tsx
git commit -m "fix: 종목 상세 mock 종목과 0원 폴백 제거" -m "- 알 수 없는 종목 코드에서 첫 번째 mock 종목을 표시하지 않도록 수정" -m "- live quote가 없을 때 0원 대신 시세 연결 중 상태를 표시" -m "- 종목 상세 화면을 not-found 래퍼와 상세 콘텐츠로 분리"
```

---

### Task 4: Price Alerts Do Not Use Mock Current Price

**Files:**
- Modify: `apps/native/src/screens/settings/price-alert-new.tsx`
- Modify: `apps/native/src/screens/settings/pages.tsx`

- [ ] **Step 1: Run baseline search for mock current price**

Run:

```bash
rg -n "findStock\\([^\\n]*\\)\\?\\.price|targetPrice - stock\\.price|현재가 대비|MODE_OPTIONS|pctInput" apps/native/src/screens/settings/price-alert-new.tsx apps/native/src/screens/settings/pages.tsx
```

Expected before implementation: matches in both files.

- [ ] **Step 2: Simplify price alert creation to direct input**

In `apps/native/src/screens/settings/price-alert-new.tsx`, remove:

```ts
import { findStock } from "@/utils/data";
```

Remove the `Mode` type and `MODE_OPTIONS` constant:

```ts
type Mode = "direct" | "percent";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "direct", label: "직접 입력" },
  { value: "percent", label: "현재가 대비 %" },
];
```

In `StockPicker`, replace the selected stock metadata text with:

```tsx
          <Text style={{ fontSize: 11, color: t.fgMuted, marginTop: 2 }}>
            {selected.code} · {selected.market}
          </Text>
```

- [ ] **Step 3: Replace `ValueInput` and target calculation**

Replace `ValueInput` with:

```tsx
function PriceInput({
  priceInput,
  setPriceInput,
}: {
  priceInput: string;
  setPriceInput: (v: string) => void;
}) {
  const { t } = useMrTheme();
  return (
    <View style={{ ...INPUT_ROW, backgroundColor: t.bgSubtle }}>
      <TextInput
        keyboardType="number-pad"
        onChangeText={setPriceInput}
        placeholder="도달가 입력"
        placeholderTextColor={t.fgSubtle}
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: "700",
          color: t.fgStrong,
          padding: 0,
        }}
        value={priceInput}
      />
      <Text style={{ fontSize: 14, color: t.fgMuted, fontWeight: "700" }}>
        원
      </Text>
    </View>
  );
}
```

Replace `computeTarget` with:

```ts
function computeDirectTarget(priceInput: string): number | null {
  const value = digitsOnly(priceInput);
  return value > 0 ? value : null;
}
```

- [ ] **Step 4: Remove percent mode state from `AlertForm`**

In `AlertForm`, remove:

```ts
  const [mode, setMode] = useState<Mode>("direct");
  const [pctInput, setPctInput] = useState("");
```

Replace the target calculation block with:

```ts
  const targetPrice = computeDirectTarget(priceInput);
  const canSubmit = targetPrice !== null && !createAlert.isPending;
```

Replace the `SettingsGroup label="가격 설정"` content with:

```tsx
      <SettingsGroup label="가격 설정">
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 11, color: t.fgSubtle }}>
            현재가 데이터가 연결되기 전까지 도달가는 직접 입력만 사용할 수 있어요.
          </Text>

          <PriceInput
            priceInput={priceInput}
            setPriceInput={setPriceInput}
          />

          <View
            style={{
              marginTop: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, color: t.fgMuted }}>도달가</Text>
            <Text
              style={{ fontSize: 15, fontWeight: "800", color: t.fgStrong }}
            >
              {targetPrice === null ? "-" : `${fmt.price(targetPrice)}원`}
            </Text>
          </View>
        </View>
      </SettingsGroup>
```

- [ ] **Step 5: Remove mock diff from existing alert rows**

In `apps/native/src/screens/settings/pages.tsx`, change:

```ts
import { SegmentedControl, StockLogo, Switch } from "@/components/ui";
```

to:

```ts
import { SegmentedControl, Switch } from "@/components/ui";
```

Remove:

```ts
import { findStock } from "@/utils/data";
```

In `PriceAlertRow`, replace:

```ts
  const stock = findStock(alert.stockCode);
  const name = stock?.name ?? alert.stockName ?? alert.stockCode;
  const diff = stock
    ? ((alert.targetPrice - stock.price) / stock.price) * 100
    : null;
```

with:

```ts
  const name = alert.stockName ?? alert.stockCode;
```

Replace the logo block with the existing non-stock avatar branch only:

```tsx
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: t.bgSubtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "800", color: t.fgMuted }}>
          {name.charAt(0)}
        </Text>
      </View>
```

Remove this diff JSX:

```tsx
          {diff === null ? null : (
            <Text style={{ color: t.fgSubtle }}>
              {"  "}(현재가 대비 {diff > 0 ? "+" : ""}
              {diff.toFixed(1)}%)
            </Text>
          )}
```

- [ ] **Step 6: Verify mock current price usage is gone**

Run:

```bash
rg -n "findStock\\([^\\n]*\\)\\?\\.price|targetPrice - stock\\.price|현재가 대비|MODE_OPTIONS|pctInput" apps/native/src/screens/settings/price-alert-new.tsx apps/native/src/screens/settings/pages.tsx
```

Expected after implementation: no matches.

- [ ] **Step 7: Commit task**

```bash
git add apps/native/src/screens/settings/price-alert-new.tsx apps/native/src/screens/settings/pages.tsx
git commit -m "fix: 가격 알림 mock 현재가 계산 제거" -m "- 가격 알림 생성에서 mock 현재가 기반 퍼센트 계산을 제거" -m "- 신뢰 가능한 현재가가 없을 때 직접 입력만 허용" -m "- 기존 가격 알림 목록에서 mock 현재가 대비 diff 표시를 숨김"
```

---

### Task 5: Search Screen Removes Mock Market Numbers

**Files:**
- Modify: `apps/native/src/screens/search/index.tsx`

- [ ] **Step 1: Run baseline search for search-screen mock numbers**

Run:

```bash
rg -n "fmt\\.price\\(stock\\.price\\)|fmt\\.pct\\(stock\\.changePct\\)|changeColor\\(stock\\.change|fmt\\.pct\\(s\\.changePct\\)|changeColor\\(s\\.change" apps/native/src/screens/search/index.tsx
```

Expected before implementation: matches in result rows and trending rows.

- [ ] **Step 2: Remove unused market formatting imports**

In `apps/native/src/screens/search/index.tsx`, remove:

```ts
import { changeColor, fmt } from "@/utils/format";
```

- [ ] **Step 3: Replace `ResultRow` right-side price block**

In `ResultRow`, replace:

```tsx
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}>
          {fmt.price(stock.price)}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: changeColor(stock.change, t),
          }}
        >
          {fmt.pct(stock.changePct)}
        </Text>
      </View>
```

with:

```tsx
      <Text style={{ color: t.fgSubtle, fontSize: 11, fontWeight: "700" }}>
        시세 연결 전
      </Text>
```

- [ ] **Step 4: Replace trending row percent text**

In the trending row render, replace:

```tsx
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: changeColor(s.change, t),
                  }}
                >
                  {fmt.pct(s.changePct)}
                </Text>
```

with:

```tsx
                <Text
                  style={{
                    color: t.fgSubtle,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  시세 연결 전
                </Text>
```

- [ ] **Step 5: Verify search mock numbers are gone**

Run:

```bash
rg -n "fmt\\.price\\(stock\\.price\\)|fmt\\.pct\\(stock\\.changePct\\)|changeColor\\(stock\\.change|fmt\\.pct\\(s\\.changePct\\)|changeColor\\(s\\.change" apps/native/src/screens/search/index.tsx
```

Expected after implementation: no matches.

- [ ] **Step 6: Commit task**

```bash
git add apps/native/src/screens/search/index.tsx
git commit -m "fix: 검색 화면 mock 시세 표시 제거" -m "- 정적 검색 결과에서 mock 가격과 등락률을 표시하지 않도록 수정" -m "- 실시간 인기 목록에서 mock 등락률을 숨김" -m "- 서버 검색 전환 전까지 시세 연결 전 상태를 표시"
```

---

### Task 6: News Detail Sheet Removes Mock Stock Snapshot Values

**Files:**
- Modify: `apps/native/src/screens/news/index.tsx`

- [ ] **Step 1: Run baseline search for news mock stock snapshot**

Run:

```bash
rg -n "dummyStock\\.price|dummyStock\\.change|dummyStock\\.changePct|dummyStock\\.score|ScorePill|changeColor|fmt\\.price|fmt\\.pct" apps/native/src/screens/news/index.tsx
```

Expected before implementation: matches in `NewsSheet`.

- [ ] **Step 2: Remove unused imports**

In `apps/native/src/screens/news/index.tsx`, remove `ScorePill` from the UI import:

```ts
-  ScorePill,
```

Remove the format import:

```ts
import { changeColor, fmt } from "@/utils/format";
```

- [ ] **Step 3: Replace news stock snapshot market value block**

In `NewsSheet`, replace:

```tsx
                {dummyStock ? (
                  <Text style={{ fontSize: 12, color: t.fgMuted }}>
                    {fmt.price(dummyStock.price)}원 ·{" "}
                    <Text style={{ color: changeColor(dummyStock.change, t) }}>
                      {fmt.pct(dummyStock.changePct)}
                    </Text>
                  </Text>
                ) : null}
              </View>
              {dummyStock ? <ScorePill score={dummyStock.score} /> : null}
```

with:

```tsx
                <Text style={{ fontSize: 12, color: t.fgMuted }}>
                  시세 정보는 준비 중입니다.
                </Text>
              </View>
```

- [ ] **Step 4: Verify news mock snapshot values are gone**

Run:

```bash
rg -n "dummyStock\\.price|dummyStock\\.change|dummyStock\\.changePct|dummyStock\\.score|ScorePill|changeColor|fmt\\.price|fmt\\.pct" apps/native/src/screens/news/index.tsx
```

Expected after implementation: no matches.

- [ ] **Step 5: Commit task**

```bash
git add apps/native/src/screens/news/index.tsx
git commit -m "fix: 뉴스 상세 mock 종목 시세 제거" -m "- 뉴스 상세 시트에서 mock 현재가와 등락률을 표시하지 않도록 수정" -m "- mock 점수 배지를 제거하고 시세 준비 상태를 표시" -m "- 종목명과 로고 메타데이터만 유지"
```

---

### Task 7: Final Static Verification and Ultracite Check

**Files:**
- Verify: `apps/native/src`
- Verify: `docs/superpowers/specs/2026-06-12-native-no-mock-market-values-design.md`

- [ ] **Step 1: Run global disallowed-pattern search**

Run:

```bash
rg -n "stocks\\[0\\]|indices as fallbackIndices|useIndexStream\\(fallbackIndices\\)|findStock\\([^\\n]*\\)\\?\\.price|dummyStock\\.(price|change|changePct|score)|stock\\.(price|change|changePct|spark)" apps/native/src/screens apps/native/src/components/cards.tsx apps/native/src/hooks/use-index-stream.ts --glob '!**/*.temp'
```

Expected: no matches.

- [ ] **Step 2: Check remaining `utils/data` imports are metadata-only**

Run:

```bash
rg -n "from \"@/utils/data\"|findStock\\(" apps/native/src --glob '!**/*.temp'
```

Expected: remaining matches are allowed metadata usage such as names, codes, sectors, logo colors, or TypeScript-only types. If a match reads `.price`, `.change`, `.changePct`, `.spark`, or `.score` for rendering market-like UI, fix it before continuing.

- [ ] **Step 3: Run Ultracite**

Run:

```bash
pnpm dlx ultracite check
```

Expected: exits successfully.

- [ ] **Step 4: Run type check**

Run:

```bash
pnpm check-types
```

Expected: exits successfully.

- [ ] **Step 5: Optional Expo runtime check**

Run if the native dev environment is available:

```bash
pnpm dev:native
```

Expected: Expo starts. Manually open the app and check these screens:

- Home: KOSPI/KOSDAQ cards show live values only after realtime data arrives; before that they show a connection state.
- Stock detail: an unknown code shows not-found; a known code without live quote shows `시세 연결 중`.
- Price alert creation: only direct target input is available.
- Price alert list: no current-price-derived diff is shown.
- Search: search results and trending rows do not show mock price or mock percent.
- News detail: stock snapshot does not show mock price, mock percent, or mock score.

If Expo cannot run in the current environment, record the reason in the final implementation report.

- [ ] **Step 6: Commit verification fixes if needed**

If Step 1 through Step 4 required code changes, commit them:

```bash
git add apps/native/src
git commit -m "fix: 네이티브 시세 mock 제거 검증 반영" -m "- 남은 시세성 mock 표시 경로를 정적 검색으로 확인" -m "- Ultracite와 타입 검증 결과에 맞춰 수정" -m "- native 화면의 데이터 없음 상태를 유지"
```

If no files changed after verification, do not create an empty commit.

---

## Completion Report Checklist

When implementation is complete, report:

- The commit hashes created for each task.
- The exact `rg` verification command results.
- Whether `pnpm dlx ultracite check` passed.
- Whether `pnpm check-types` passed.
- Whether Expo runtime verification was run, and if not, why.
