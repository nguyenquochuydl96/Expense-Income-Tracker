# TEST_READY.md — Dual-Track E2E Test Suite Certification

**Project**: Expense & Income Tracker ("Sổ thu chi Chuối & Đậu")  
**Author**: `teamwork_test_writer`  
**Date**: 2026-11-09T10:47:00Z  
**Status**: **CERTIFIED READY (100% PASS)**

---

## 1. Test Suite Summary

The comprehensive, opaque-box E2E test suite for Expense & Income Tracker has been constructed, validated, and verified across all four primary tiers.

- **Total Test Cases**: **95**
- **Passed**: **95**
- **Failed**: **0**
- **Pass Rate**: **100%**
- **Test Runner Command**: `node tests/e2e/runner.js`
- **Execution Time**: ~33 ms (excluding initial TypeScript build step)
- **Exit Code**: `0`

---

## 2. Tier Breakdown Table

| Tier | Category | Focus Areas | Total | Passed | Failed | Status |
|---|---|---|---|---|---|---|
| **Tier 1** | **Feature Coverage** | Ledger CRUD, Sync Reconciliation, Envelope Rollovers, Runway Metrics, BE Cycle (26–25), Credit Cycle (20–19), Dedicated Income, Money Math, Privacy Masking | **45** | **45** | **0** | **PASS** |
| **Tier 2** | **Boundary & Corner Cases** | Feb 28/29, Apr 30, Dec 31/Jan 1, Negative Refunds, BE Reversals, Credit Cashbacks, Zero Budgets, 10B VND, Abbreviations (1tr5, 50k), Unicode | **30** | **30** | **0** | **PASS** |
| **Tier 3** | **Cross-Feature Pairwise** | Virtual Transfers + Rollovers, Offline Edits + Sync Queue, Privacy Mode + Formatters, Billing Cycles + Runway Pacing, Dedicated Income + Rollover Modes, Calculator + Ledger | **15** | **15** | **0** | **PASS** |
| **Tier 4** | **Real-World Scenarios** | Full-Month Dual-Income Family Living, Business Travel & BE Reimbursement, Credit Statement Cutoff Audit, Dedicated Travel Bonus Influx, 4-Month Wedding Shock Deficit Recovery | **5** | **5** | **0** | **PASS** |
| **Total** | | **All Primary Tiers (1–4)** | **95** | **95** | **0** | **PASS** |

---

## 3. Detailed Feature Mapping & Verification Matrix

### Tier 1: Feature Coverage (45 Tests)
- **Ledger CRUD Operations (5 tests)**:
  - `T1.F1.1`: Create expense transaction record with complete attributes.
  - `T1.F1.2`: Filter ledger transactions by `monthKey` and `sheetType`.
  - `T1.F1.3`: Update transaction attributes and preserve audit integrity.
  - `T1.F1.4`: Delete transaction removes item and recalculates ledger aggregate.
  - `T1.F1.5`: Chronological sorting orders transactions by date descending.
- **Google Sheets Sync & Row Index Management (5 tests)**:
  - `T1.F2.1`: Assign `rowIndex` to optimistic additions and shift indices on deletion.
  - `T1.F2.2`: Expense row values array mapping formats correctly for Google Sheets API.
  - `T1.F2.3`: Income row values mapping includes Column E (Month) for formula lookup.
  - `T1.F2.4`: Offline transaction queue tracks pending mutations.
  - `T1.F2.5`: Reconcile real-world account balances against ledger tracked sums.
- **Multi-Month Budget Rollover Engine (5 tests)**:
  - `T1.F3.1`: Historical era (T4-T7 2026) computes base budget with 47.5M ratios.
  - `T1.F3.2`: Current era (T8-T10 2026) computes base budget with 51M ratios.
  - `T1.F3.3`: Full rollover carries both surplus and deficit forward across months.
  - `T1.F3.4`: Deficit-only rollover mode ignores positive surpluses and carries only deficits.
  - `T1.F3.5`: None rollover mode resets carryover to 0 regardless of prior balance.
- **Daily Living Runway & Burn Rate Metrics (5 tests)**:
  - `T1.F4.1`: Isolate daily living categories from fixed & periodic categories.
  - `T1.F4.2`: Safe daily allowance correctly computes `totalRemaining / remainingDays`.
  - `T1.F4.3`: Burn rate daily computes `totalSpent / elapsedDays`.
  - `T1.F4.4`: Pace differential identifies safe vs over-burn pace.
  - `T1.F4.5`: Calendar days in month handles 30, 31, and 28/29 day counts accurately.
- **BE Corporate Billing Cycle 26–25 (5 tests)**:
  - `T1.F5.1`: Calculate standard 26–25 cycle date range for current year month.
  - `T1.F5.2`: Year transition boundary: January cycle starts December 26 of previous year.
  - `T1.F5.3`: Filter transactions with `beCorp` flag within BE cycle boundaries.
  - `T1.F5.4`: Fallback to full calendar month when `startDay <= endDay`.
  - `T1.F5.5`: Corrupted or invalid `monthKey` defaults safely to standard date range.
- **Credit Card Billing Cycle 20–19 (5 tests)**:
  - `T1.F6.1`: Calculate standard 20–19 cycle range for statement generation.
  - `T1.F6.2`: Year transition boundary: January cycle starts December 20 of previous year.
  - `T1.F6.3`: Filter transactions with credit payment within credit statement bounds.
  - `T1.F6.4`: Credit utilization against defined limit.
  - `T1.F6.5`: Custom statement day configuration (e.g., 15th to 14th).
- **Dedicated Income Allocations (5 tests)**:
  - `T1.F7.1`: Identify dedicated income vs general shared salary income.
  - `T1.F7.2`: Dedicated income is added 100% to target category base budget.
  - `T1.F7.3`: Dedicated income does not inflate base budget of other categories.
  - `T1.F7.4`: Case insensitive and whitespace trimming in dedicated income matching.
  - `T1.F7.5`: Dedicated income rolls over to subsequent months under full rollover.
- **Money Mathematical Expressions Evaluator (5 tests)**:
  - `T1.F8.1`: Evaluate basic arithmetic expressions (+, -, *, /).
  - `T1.F8.2`: Vietnamese abbreviations (k, K, tr, m, M).
  - `T1.F8.3`: Spoken Vietnamese compound denominations (`1tr5` -> 1.5M, `2tr2` -> 2.2M).
  - `T1.F8.4`: Combined expressions with abbreviations and operators.
  - `T1.F8.5`: Fallback safety for plain numbers and comma formatted strings.
- **Financial Privacy Masking Engine (5 tests)**:
  - `T1.F9.1`: Privacy mode defaults to enabled on startup.
  - `T1.F9.2`: `formatCurrency` masks numbers when privacy mode is active.
  - `T1.F9.3`: `formatNumberForSheet` masks numbers when privacy mode is active.
  - `T1.F9.4`: `forceVisible` parameter bypasses privacy masking when needed.
  - `T1.F9.5`: Toggling privacy mode off reveals unmasked formatted amounts.

### Tier 2: Boundary & Corner Cases (30 Tests)
- **Boundary 1: Calendar Date & Year Transitions (5 tests)**: Leap year Feb 29 vs 28, 30-day month ends (Apr, Sep, Nov), Dec 31 to Jan 1, short month cycle clamps, Vietnamese month string formats.
- **Boundary 2: Negative Refunds, Reversals & Offsets (5 tests)**: `parseSheetNumber` negative parsing, negative reimbursements in BE Corp, negative credit card returns, negative budget transfer reverse actions, net negative category spending.
- **Boundary 3: Zero Budgets, 0% Allocations & Empty States (5 tests)**: 0% category allocation, 0 transaction categories, 0 effective budget with spending (`isOver=true`, `pctUsed=999`), 0 income months, empty ledger safety.
- **Boundary 4: Extreme Numbers & Arithmetic Precision (5 tests)**: Multi-billion (10B VND) amounts, fractional abbreviations (`1.5tr`, `50.5k`), operator precedence (`*`, `/`, `+`, `-`), non-integer division rounding, excess whitespace/symbol trimming.
- **Boundary 5: Malformed Inputs, Missing Fields & Unicode (5 tests)**: Missing category fallback to 'Khác', invalid date fallback, syntax error handling in money parser, Vietnamese accents and emojis, partial date conversions.
- **Boundary 6: Runway Edge Cases & Pacing Boundaries (5 tests)**: Day 1 division by zero avoidance, last day remaining calculation, single-day budget blowout, zero living expense month, completed past month status.

### Tier 3: Cross-Feature Combinations (15 Tests)
- **Pairwise 1: Virtual Transfers + Multi-Month Rollover (3 tests)**: Inter-category transfers preserving household net sum, Month 1 transfer cascading into Month 2 carryover, legacy `[Transfer]` item separation from living expense totals.
- **Pairwise 2: Offline Edits + Sync Queue Reconciliation (3 tests)**: Coexistence of local and synchronized records, deletion re-indexing for pending sync payloads, queue state transitions.
- **Pairwise 3: Privacy Mode + Table Formatting & Masking (3 tests)**: Synchronous formatters toggling, forceVisible audit overrides, +/- sign retention.
- **Pairwise 4: Billing Cycles + Living Runway Pacing (2 tests)**: Corporate business travel exclusion from family living runway burn rate, credit card purchases crossing statement day (20th) into next cycle liability.
- **Pairwise 5: Dedicated Income + Rollover Modes (2 tests)**: Dedicated income combined with `deficit_only` mode, month with only dedicated income (0 general income) maintaining correct isolation.
- **Pairwise 6: Calculator Expressions + Ledger Validation (2 tests)**: Ingesting compound expressions into clean integer ledger amounts, negative offset expressions generating valid negative refund records.

### Tier 4: Real-World Living Scenarios (5 Tests)
- **Scenario 1**: Full-Month Dual-Income Family Living Simulation (Day 1-30 simulation with pet emergency, 1.5M budget transfer, and positive month closure).
- **Scenario 2**: Business Travel & BE Corporate Cycle Reimbursement Flow (Flights, hotel, client dinner, negative ticket refund, cycle closure, living runway isolation).
- **Scenario 3**: Credit Card Statement Cycle & Cashflow Audit (Cutoff enforcement on 20th, statement reconciliation, bank balance update).
- **Scenario 4**: Bonus Influx & Dedicated Income Travel Project (15M dedicated travel bonus, trip spending, surplus rollover to subsequent month).
- **Scenario 5**: 4-Month Stress Test with Rollover Deficit Recovery (Wedding season overspend shock in May, June deficit austerity, July recovery bonus).

---

## 4. Test Files Manifest

```
tests/
├── tsconfig.json                      # Test build configuration
├── dist/                              # Output build cache
│   └── package.json                   # CommonJS module marker
└── e2e/
    ├── runner.js                      # Executable test runner and executive reporter
    ├── testHarness.ts                 # Type-safe assertion & registry harness
    ├── tier1_features.test.ts         # 45 Feature Coverage Tests
    ├── tier2_boundaries.test.ts       # 30 Boundary & Edge Case Tests
    ├── tier3_cross_feature.test.ts    # 15 Pairwise Interaction Tests
    └── tier4_real_world.test.ts       # 5 Real-World Scenario Tests
```

---

## 5. Certification

The test suite satisfies all requirements set forth in `PROJECT.md` and `DISPATCH.md`. The test runner executes reliably under Node.js v20+ with zero external test runner dependencies and clean exit code `0`. It is certified ready for downstream milestone integration and Tier 5 adversarial coverage.
