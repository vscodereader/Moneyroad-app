# Web Store Download CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace web pre-registration CTAs with App Store and Google Play download CTAs.

**Architecture:** Keep the landing page as a Server Component and add a focused reusable `StoreButtons` presentation component for external store links. Use official store icon assets inside transparent ghost-style buttons for the store CTAs, and update metadata and page copy without changing waitlist API or database code.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS, lucide-react, Ultracite/Biome.

---

### Task 1: Confirm Current CTA Fails Launch-State Check

**Files:**
- Read: `apps/web/src/app/page.tsx`
- Read: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Run red static check**

```bash
node -e "const fs=require('node:fs');const page=fs.readFileSync('apps/web/src/app/page.tsx','utf8');const layout=fs.readFileSync('apps/web/src/app/layout.tsx','utf8');const store=fs.existsSync('apps/web/src/components/landing/store-buttons.tsx')?fs.readFileSync('apps/web/src/components/landing/store-buttons.tsx','utf8'):'';const landing=page+store;if(!landing.includes('https://apps.apple.com/kr/app/%EB%A8%B8%EB%8B%88%EB%A1%9C%EB%93%9C/id6772923139')) throw new Error('missing App Store link');if(!landing.includes('https://play.google.com/store/apps/details?id=kr.ai.moneyroad')) throw new Error('missing Google Play link');if(page.includes('사전등록')) throw new Error('pre-registration CTA still visible');if(layout.includes('사전등록')) throw new Error('metadata still says pre-registration');"
```

Expected: FAIL with `missing App Store link` before implementation.

### Task 2: Add Store Button Component

**Files:**
- Create: `apps/web/src/components/landing/store-buttons.tsx`

- [ ] **Step 1: Create reusable store links**

Add a server-safe React component that exports `StoreButtons`, defines the two verified store URLs, renders official icon assets inside ghost-style store buttons, and applies `target="_blank"` with `rel="noopener noreferrer"`.

- [ ] **Step 2: Keep button layout stable**

Use fixed height, responsive `flex-col sm:flex-row`, and `min-w-0` text wrappers so Korean and English labels do not overflow on mobile.

### Task 3: Update Landing Page Copy and CTAs

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Replace waitlist import**

Remove `WaitlistForm` from the landing page import list and import `StoreButtons`.

- [ ] **Step 2: Update header CTA**

Change the header link from `href="#waitlist"` and `사전등록` to `href="#download"` and `앱 다운로드`.

- [ ] **Step 3: Update hero launch copy**

Change the hero badge to `App Store · Google Play 정식 출시`, replace the waitlist form block with `<StoreButtons />`, and add a short helper line that says iOS and Android users can install immediately.

- [ ] **Step 4: Update bottom CTA**

Change the dark CTA title and body from launch notification language to immediate download language, then render `<StoreButtons variant="onDark" />`.

### Task 4: Update Metadata

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Remove pre-registration language**

Update `SITE_DESCRIPTION` so it says the app is available on App Store and Google Play, not that users should pre-register.

### Task 5: Verify

**Files:**
- Check: `apps/web/src/app/page.tsx`
- Check: `apps/web/src/app/layout.tsx`
- Check: `apps/web/src/components/landing/store-buttons.tsx`

- [ ] **Step 1: Run green static check**

```bash
node -e "const fs=require('node:fs');const page=fs.readFileSync('apps/web/src/app/page.tsx','utf8');const layout=fs.readFileSync('apps/web/src/app/layout.tsx','utf8');const store=fs.readFileSync('apps/web/src/components/landing/store-buttons.tsx','utf8');const landing=page+store;if(!landing.includes('https://apps.apple.com/kr/app/%EB%A8%B8%EB%8B%88%EB%A1%9C%EB%93%9C/id6772923139')) throw new Error('missing App Store link');if(!landing.includes('https://play.google.com/store/apps/details?id=kr.ai.moneyroad')) throw new Error('missing Google Play link');if(page.includes('사전등록')) throw new Error('pre-registration CTA still visible');if(layout.includes('사전등록')) throw new Error('metadata still says pre-registration');"
```

Expected: PASS with exit code 0 after implementation.

- [ ] **Step 2: Run build**

```bash
pnpm -F web build
```

Expected: PASS with exit code 0.

### Task 6: Fix Build-Blocking Shared UI React Type Boundary

**Files:**
- Modify: `packages/ui/src/components/skeleton.tsx`

- [ ] **Step 1: Reproduce web typecheck failure**

```bash
pnpm -F web exec tsc --noEmit --pretty false
```

Expected before fix: FAIL at `packages/ui/src/components/skeleton.tsx` with incompatible React `ref` types.

- [ ] **Step 2: Match existing UI component import pattern**

Add the same type-only React import used by `packages/ui/src/components/input.tsx` and `packages/ui/src/components/card.tsx`:

```tsx
import type * as React from "react";
```

- [ ] **Step 3: Verify typecheck and build**

```bash
pnpm -F web exec tsc --noEmit --pretty false
pnpm -F @moneyroad-app/ui check-types
pnpm -F web build
pnpm check
```

Expected: all commands PASS with exit code 0.

- [ ] **Step 3: Run Ultracite check**

```bash
pnpm check
```

Expected: PASS with exit code 0.
