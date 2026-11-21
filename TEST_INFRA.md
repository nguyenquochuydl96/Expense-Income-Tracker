# TEST_INFRA.md — Dual-Track Testing Infrastructure

## 1. Testing Philosophy & Principles

The Expense & Income Tracker ("Sổ thu chi Chuối & Đậu") test infrastructure follows an **opaque-box, requirement-driven dual-track testing philosophy**.

1. **Opaque-Box Verification**: Tests interact strictly through public interfaces, business logic functions, API contracts, and user-observable state transitions. Internal implementation mechanics are treated as black boxes; tests assert the *what*, not the *how*.
2. **Authoritative Specification Grounding**: Expected outputs derive directly from the authoritative specifications established in `PROJECT.md`, `ORIGINAL_REQUEST.md`, and Google Sheet mathematical models (`Source data validation` T4-T7 47.5M and T8-T10 51M allocation formulas).
3. **No Facade Tests**: Every test exercises real business logic, multi-month rollover chaining, date boundary clamping, currency math, and ledger mutations. Facade tests that trivially assert truthy values without asserting financial correctness are prohibited.
4. **Adversarial & Edge-Case Rigor**: Boundary conditions (leap years, month transitions, zero denominators, negative refunds, extreme values, Vietnamese unicode) are systematically probed to prevent runtime crashes, NaN propagation, or silent data corruption.
5. **Progressive Independence & Isolation**: Each test case sets up its own fixtures, avoids execution order coupling, and cleans up any persistent state.

---

## 2. Dual-Track Testing Architecture

The test suite is organized into 5 tiers, with Tiers 1–4 implemented by `teamwork_test_writer` and Tier 5 reserved for white-box adversarial stress testing:

```
tests/
├── tsconfig.json                # Test compilation configuration (ES2022 / CommonJS target)
├── dist/                        # Compiled test output directory
│   └── package.json             # CommonJS runtime marker
└── e2e/
    ├── runner.js                # Master test orchestrator & CLI reporter
    ├── testHarness.ts           # Assertion engine, describe/test registry, metrics
    ├── tier1_features.test.ts   # Tier 1: Core Feature Coverage (>=5 tests per feature)
    ├── tier2_boundaries.test.ts # Tier 2: Boundary & Corner Cases (>=5 tests per class)
    ├── tier3_cross_feature.test.ts # Tier 3: Pairwise Cross-Feature Interactions
    └── tier4_real_world.test.ts # Tier 4: Real-World Living Scenarios & Workloads
```

---

## 3. Feature Inventory & Tier Coverage Mapping

| Feature # | Feature Name | Tier 1 (Coverage) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|---|---|---|---|---|---|
| **F-01** | Ledger CRUD & Transactions | Ledger CRUD tests (5+) | Missing fields, unicode (5+) | Offline edits + sync (3+) | Family living simulation |
| **F-02** | Google Sheet Sync & Reconcile | Sync payload, row indexing (5+) | API error payloads, empty states (5+) | Sync queue + offline local edits (3+) | Bank reconcile audit |
| **F-03** | Multi-Month Budget Rollover | Envelope rollovers, T4-T7 & T8-T10 (5+) | Zero budgets, 0% categories (5+) | Virtual transfers + rollover (3+) | Deficit recovery cycle |
| **F-04** | Daily Living Runway & Pacing | Runway burn rate & safe allowance (5+) | Zero elapsed days, future months (5+) | Billing cycle + runway pacing (3+) | Living burn rate throttling |
| **F-05** | BE Corporate Cycle (26–25) | Cycle range, filtering, labels (5+) | Year boundary (Dec 26 - Jan 25) (5+) | BE cycle + living separation (3+) | Business trip reimbursement |
| **F-06** | Credit Card Cycle (20–19) | Cycle cutoff, filtering, limits (5+) | Statement day variations, 30-day (5+) | Credit card + cashflow audit (3+) | Credit statement audit |
| **F-07** | Dedicated Income Allocations | Dedicated income detection & 100% assign (5+) | Mixed income, 0 general income (5+) | Dedicated income + rollover modes (3+) | Bonus influx travel project |
| **F-08** | Money Calculator & Expressions | Expression parser (+, -, *, /, k, tr) (5+) | Large numbers, fractional expressions (5+) | Calculator + ledger input validation (3+) | Expense logging simulation |
| **F-09** | Privacy Masking Engine | Privacy toggle, global state (5+) | Formatters with privacy active (5+) | Privacy mode + table memoization (3+) | Privacy toggle audit |

---

## 4. Test Tiers Breakdown

### Tier 1: Feature Coverage (Core Happy Paths)
- **Target**: >= 5 rigorous test cases for every distinct core feature.
- **Coverage**:
  1. **Ledger CRUD**: Create expense with full attributes, filter by month/category/sheetType, update fields, delete record, chronological sorting.
  2. **Sync Reconciliation**: Row index adjustment, sheet tab header mapping, optimistic additions, balance reconciliation.
  3. **Envelope Rollovers**: Multi-month budget chaining, T4-T7 (Apr-Jul) historical ratios, T8-T10 (Aug-Oct) current ratios, full rollover mode, deficit-only rollover mode, none rollover mode.
  4. **Daily Living Runway**: Living category isolation ('Ăn uống', 'Giải trí Heo', 'Giải trí Mèo', 'Hóa/Mỹ phẩm'), safe daily allowance, burn rate, pace diff.
  5. **BE Corporate Cycle (26th–25th)**: Date boundary generation, filtering, corporate expense separation, label generation.
  6. **Credit Card Cycle (20th–19th)**: Statement date boundaries, card expense filtering, credit utilization calculations.
  7. **Dedicated Income Allocations**: Identification of dedicated vs general income categories, 100% allocation to target category base budget, isolation from general % split.

### Tier 2: Boundary & Corner Cases
- **Target**: >= 5 rigorous edge-case tests per boundary category.
- **Coverage**:
  1. **Calendar Date Boundaries**: Leap year Feb 29 vs Feb 28, 30-day month ends (Apr 30, Jun 30, Sep 30, Nov 30), year rollover (Dec 31 -> Jan 1), cycle date clamping on short months.
  2. **Negative Refunds & Offsets**: Parsing negative sheet numbers, negative reimbursements in BE Corp, cashback returns on Credit Card, negative amounts in budget transfers, category surplus over-refunds.
  3. **Zero Budgets & Empty States**: 0% category allocations, 0 transaction months, 0 income months, empty ledger safety, zero effective budget with non-zero spending.
  4. **Large Numbers & Precision**: Multi-billion VND amounts (10,000,000,000 VND), fractional Vietnamese currency abbreviations ("1.5tr", "2,5tr", "50.5k"), chained arithmetic, integer division rounding.
  5. **Missing & Malformed Inputs**: Missing categories defaulting to 'Khác', whitespace/accented inputs, invalid date strings, syntax errors in calculator expressions.
  6. **Runway Pacing Boundaries**: 1st day of month (1 day elapsed), future month elapsed day handling, completed past month status, single-day budget blowout.

### Tier 3: Cross-Feature Combinations (Pairwise)
- **Target**: Rigorous pairwise integration tests validating subsystem co-operation.
- **Coverage**:
  1. Virtual Transfers + Multi-Month Rollover (transfers altering category carryovers while preserving total system balance).
  2. Offline Edits + Sync Reconciliation (local mutations with pending sync state, row index recalculations).
  3. Privacy Mode + Table Formatting & Ledger Visibility (masking sensitive financial figures across views).
  4. Billing Cycles (BE & Credit) + Living Runway Pacing (corporate and credit card transactions separated from daily living burn rate).
  5. Dedicated Income + Rollover Modes (dedicated income interacting with full, deficit-only, and none carryover rules).
  6. Calculator Inputs + Transaction Ingestion (evaluating expressions into normalized integer amounts stored in ledger).

### Tier 4: Real-World Application Scenarios
- **Target**: Comprehensive multi-step end-to-end user workflows simulating actual household financial life.
- **Coverage**:
  1. **Scenario 1**: Full-Month Dual-Income Family Living Simulation (salary arrival, rent, groceries, pet emergency, budget transfer, runway adjustment, month close).
  2. **Scenario 2**: Business Travel & BE Corporate Cycle Reimbursement Flow (flights, hotel, meals, negative ticket refund, cycle closure, separation from living expenses).
  3. **Scenario 3**: Credit Card Statement Cycle & Cashflow Audit (purchases across cycle cutoff, statement cutoff reconciliation, bank balance vs card debt).
  4. **Scenario 4**: Bonus Influx & Dedicated Income Travel Project (salary + dedicated holiday bonus, travel expense tracking, surplus carryover).
  5. **Scenario 5**: Multi-Month Stress Test with Rollover Deficit Recovery (4-month journey: normal month, wedding season overspend shock, full rollover deficit, family spending curtailment, recovery).

---

## 5. Execution & Verification

### Running the Test Suite
The entire E2E test suite is executed with a single command from the project root:

```powershell
node tests/e2e/runner.js
```

### Build & Compilation Lifecycle
1. `runner.js` automatically invokes the TypeScript compiler (`tsc -p tests/tsconfig.json`) to compile all test files into `tests/dist/`.
2. Tests are dynamically loaded and executed tier-by-tier in an isolated runner environment.
3. Test metrics (pass/fail count, assertions count, duration) are logged with executive formatting.
4. Process exits with code `0` on 100% pass, or code `1` if any test fails.
