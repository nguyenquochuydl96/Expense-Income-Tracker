# Project: Expense & Income Tracker ("Sổ thu chi Chuối & Đậu") — Comprehensive App Overhaul & Hardening

## Architecture
- **Framework & Core**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4.
- **State Management & Data Layer**:
  - In-memory React state in `App.tsx` with optimistic updates.
  - Asynchronous background synchronization with Google Sheets API and Apps Script Web App.
  - Persistent storage cache for offline operation and fast startup.
- **Visual Design & Themes**:
  - Dual design systems: **Kinlo (Ocean Teal)** and **Cofra (Mono Luxe)** with Light and Dark modes.
  - Micro-interactions powered by Motion (`motion/react`) with full `prefers-reduced-motion` compliance.
- **Accounting & Business Engine**:
  - Dual billing cycles: BE Corp (26th–25th) and Credit Cards (20th–19th).
  - Multi-month envelope budgeting with rollover carryovers, dedicated income allocations, and virtual transfers.
  - Daily living runway calculation and burn rate metrics.

---

## Feature Inventory
Every defect, performance bottleneck, UX/UI requirement, and accounting integrity rule identified in the Phase 0 Survey is cataloged below and assigned to an authoritative milestone. No feature is left unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Sync Row Index Management | Assign real `rowIndex` to optimistically added transactions and adjust subsequent indices upon row deletion | M1 | survey_1 (BUG-01, BUG-02) |
| 2 | Sheet Mutation Integrity | Write Column E (Month) on Income updates and preserve negative refund values for `beCorp` and `credit` | M1 | survey_1 (BUG-03, BUG-04) |
| 3 | Transfer Separation in Reports & Heatmaps | Exclude virtual `[Transfer]` budget envelopes from living expense totals across all views, reports, and charts | M1 | survey_1 (BUG-06) |
| 4 | Multi-Month Budget Equation Fix | Incorporate `netTransfer` into multi-month budget calculations in `CategoryBudgetTable` | M1 | survey_1 (BUG-05) |
| 5 | Billing Cycle Alignment & Date Clamping | Align `MonthlyReportCardModal` to BE (26–25) and Credit (20–19) cycles, clamp calendar days in `cycleUtils`, and make fallbacks dynamic | M1 | survey_1 (BUG-07, BUG-09, BUG-10) |
| 6 | Runway Widget Edge Case Fixes | Correct zero-elapsed calculation in future months and suppress false "an toàn" badges for completed past months | M1 | survey_1 (BUG-08) |
| 7 | React 19 State Tearing & Timer Leaks | Migrate store subscriptions to `useSyncExternalStore` and clean unmounted timers in modals and lock screen | M1 | survey_1 (BUG-11, BUG-12) |
| 8 | Bundle Size & Redundant Animation Purge | Remove redundant `@animate-ui/react` and `gsap`, consolidate onto `motion/react`, and slim `vendor-animation` | M2 | survey_2 (Perf 1.1) |
| 9 | On-Demand Firebase Lazy Loading | Lazy-load Firebase Auth dependencies so default Apps Script Web App users do not load `vendor-firebase` (96 KB) on startup | M2 | survey_2 (Perf 1.1) |
| 10 | View-Level Code Splitting | Split `TransactionLedgerTable`, `CategoryBudgetTable`, and `MultiMonthSummaryTable` into lazy chunks | M2 | survey_2 (Perf 1.1) |
| 11 | Render Memoization Callback Stabilization | Wrap inline handlers in `useCallback` to preserve `React.memo` across table views and widgets | M2 | survey_2 (Perf 1.2) |
| 12 | O(N) Budget Indexing & Calculation Dedup | Cache single-pass month maps to eliminate duplicate `computeMultiMonthRollover` and O(M*N) array scans | M2 | survey_2 (Perf 1.2) |
| 13 | Table DOM Optimization & Virtualization | Optimize mobile card vs desktop table rendering and isolate row rendering to prevent keystroke lag | M2 | survey_2 (Perf 1.2) |
| 14 | Startup Asset & CSV Optimization | Trim Google Fonts in `index.html` to active fonts and skip static CSV fetch when local records cache is populated | M2 | survey_2 (Perf 1.2) |
| 15 | Batched Sync & Debounced Push | Queue and debounce offline mutations to eliminate sequential single-row API hammering and rate-limiting | M2 | survey_2 (Perf 1.3) |
| 16 | Cofra Theme Token Harmonization | Override legacy `--theme-*` variables in Cofra mode to eliminate bright sky-blue leakage in Mono Luxe | M3 | survey_3 (UI/UX 1.1) |
| 17 | Dark Mode Form Input Contrast | Harmonize dark input backgrounds (`#202020` in Cofra) and fix unmapped `-700`/`-800` text contrast | M3 | survey_3 (UI/UX 1.1) |
| 18 | SVG Chart & Error Boundary Dark Mode | Darken SVG donut chart separator strokes and add full dark mode styling to `RootErrorBoundary` | M3 | survey_3 (UI/UX 1.1) |
| 19 | Dynamic Meta Theme Color & Viewport Cover | Add `viewport-fit=cover` and dynamic meta `theme-color` switching between light and dark modes | M3 | survey_3 (UI/UX 1.1, 1.2) |
| 20 | Mobile Safe Areas & Bottom Nav Polish | Add `pb-[env(safe-area-inset-bottom)]` and expand bottom navigation touch targets to >= 44x44px | M3 | survey_3 (UI/UX 1.2) |
| 21 | Modal Centering Overflow Fix | Prevent mobile header clipping on modals using `items-start sm:items-center` on short viewports | M3 | survey_3 (UI/UX 1.2) |
| 22 | Touch Target Expansion Across Ledger & Header | Enlarge action buttons ("Sửa", "Xóa", close buttons, header icons) to safe touch ergonomics | M3 | survey_3 (UI/UX 1.2) |
| 23 | Comprehensive ARIA & Keyboard Accessibility | Add `aria-label` to all icon buttons, convert clickable `div`s to accessible controls, and add WAI-ARIA dialog semantics | M3 | survey_3 (UI/UX 1.3) |
| 24 | Shimmer Skeleton Loading States | Replace plain text `<Suspense>` rectangles with smooth shimmer skeleton pulse loaders | M3 | survey_3 (UI/UX 1.4) |
| 25 | Full Dual-Track E2E Test Suite (Tiers 1-4) | Comprehensive opaque-box test suite verifying all accounting rules, sync flows, performance benchmarks, and UI/UX behaviors | M4 | Dual-Track Requirement |
| 26 | Adversarial Hardening (Tier 5) & Audit | White-box stress-testing, boundary fuzzing, and independent forensic integrity verification | M4 | Dual-Track Requirement |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| **M1** | Accounting Integrity & Google Sheets Sync Engine Hardening | Fix Features 1, 2, 3, 4, 5, 6, 7 | none | **DONE** (95/95 E2E pass, Gate PASS) |
| **M2** | Performance Optimization, Bundle Trimming & Asset Caching | Implement Features 8, 9, 10, 11, 12, 13, 14, 15 | M1 contracts | **DONE** (vendor-animation -38%, index.js -36.6%, Gate PASS) |
| **M3** | UI/UX Polish, Theme Consistency, Mobile Safe Areas & A11y | Implement Features 16, 17, 18, 19, 20, 21, 22, 23, 24 | none | **DONE** (152/152 tests pass, 2 Reviewers APPROVE, 2 Challengers APPROVE, Forensic Auditor CLEAN) |
| **M4** | E2E Test Suite Pass (Tiers 1-4) & Adversarial Coverage Hardening (Tier 5) | Features 25, 26: 100% test pass across all tiers, adversarial tests, forensic audit | M1, M2, M3 | **DONE** (217/217 master tests pass across 12 suites, 2 Reviewers APPROVE, 2 Challengers APPROVE, Master Forensic Auditor CLEAN) |

---

## Interface Contracts

### M1 (Sync & Engine) ↔ M2 (Performance & Tables)
- **Record Structure**: `TransactionRecord` interface retains `rowIndex?: number`, `syncedToSheet: boolean`, `syncing?: boolean`.
- **Memoized Callbacks**: `App.tsx` exposes stable callback references:
  - `handleOpenAddModal(preset?: TransactionPreset): void`
  - `handleEditTransaction(rec: TransactionRecord): void`
  - `handleDeleteTransaction(rec: TransactionRecord): void`
  - `handleToggleCharts(): void`
- **Data Normalization**: `budgetUtils.ts` exports `computeNormalizedMonthMap(records: TransactionRecord[])` providing O(1) month lookups without re-filtering the entire array.

### M1 (Engine) ↔ M3 (UI/UX & Modals)
- **Modal Contracts**:
  - `AddTransactionModal` and `EditTransactionModal` accept `isOpen: boolean`, `onClose: () => void`, `onSave: (...) => Promise<void>`.
  - Accessible dialog wrapper with `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`.
- **Theme Variables**:
  - `src/index.css` provides canonical `--theme-*` variable definitions for both `kinlo` and `cofra` presets.

---

## Code Layout
- `src/components/`:
  - `TransactionLedgerTable.tsx`, `CategoryBudgetTable.tsx`, `MultiMonthSummaryTable.tsx`, `DailyLivingRunwayWidget.tsx`, `CalendarHeatmapView.tsx`
  - Modals: `AddTransactionModal.tsx`, `EditTransactionModal.tsx`, `MonthlyReportCardModal.tsx`, `PwaInstallModal.tsx`
  - UI helpers: `AnimatedCurrency.tsx`, `SkeletonLoaders.tsx`
- `src/services/`:
  - `googleSheetsService.ts`, `appsScriptService.ts`, `firebaseAuth.ts`, `indexedDbService.ts`
- `src/utils/`:
  - `budgetUtils.ts`, `cycleUtils.ts`, `privacyService.ts`, `themeService.ts`, `formatters.ts`
- `src/index.css`: Tailwind v4 theme tokens, layer utilities, dark mode classes
- `tests/`:
  - E2E testing harness, fixtures, tier runners, stress generators
