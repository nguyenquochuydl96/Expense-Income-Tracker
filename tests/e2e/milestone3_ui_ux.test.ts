import { describe, it, expect, registry } from './testHarness';
import * as fs from 'fs';
import * as path from 'path';

describe('Milestone 3 UI/UX Polish, Themes, Mobile Safe Areas & Accessibility', () => {
  // Robust root resolver checking for vite.config.ts (which only exists at project root)
  const getProjectRoot = () => {
    let dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    while (dir && !fs.existsSync(path.join(dir, 'vite.config.ts'))) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return dir || process.cwd();
  };
  const projectRoot = getProjectRoot();

  // Helper to read project files
  const readProjectFile = (relPath: string) => {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
  };

  /* ═════════════════════════════════════════════════════════════════════
     1. Features 16 & 17: Theme Token Harmonization & Dark Input Contrast
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.1: Kinlo design system tokens defined for light and dark modes in src/index.css', () => {
    const css = readProjectFile('src/index.css');

    // Kinlo root tokens and dark tokens
    expect(css.includes(':root {')).toBe(true);
    expect(css.includes('--accent: #0e6c84;')).toBe(true);
    expect(css.includes('--accent-ink: #ffffff;')).toBe(true);
    expect(css.includes('html.dark {')).toBe(true);
    expect(css.includes('--accent: #4cc0d6;')).toBe(true);
    expect(css.includes('--night: #0c262ee0;')).toBe(true);

    // Active tab text color must be dynamic to avoid white-on-white text in dark mode
    expect(css.includes('color: var(--theme-active-tab-text, #FFFFFF) !important;')).toBe(true);
  });

  it('M3.2: Dark mode form inputs use Kinlo deep slate (#0f172a)', () => {
    const css = readProjectFile('src/index.css');

    // Kinlo dark input
    expect(css.includes('html.dark input')).toBe(true);
    expect(css.includes('background-color: #0f172a !important;')).toBe(true);
  });

  it('M3.3: Mid-tone text classes (-700, -800) have WCAG AA compliant dark mode overrides', () => {
    const css = readProjectFile('src/index.css');

    expect(css.includes('html.dark .text-emerald-700')).toBe(true);
    expect(css.includes('html.dark .text-sky-700')).toBe(true);
    expect(css.includes('html.dark .text-purple-700')).toBe(true);
    expect(css.includes('html.dark .text-amber-700')).toBe(true);
    expect(css.includes('html.dark .text-rose-700')).toBe(true);

    // ReconcileCheckTienView also has explicit dark variant classes
    const reconcileCode = readProjectFile('src/components/ReconcileCheckTienView.tsx');
    expect(reconcileCode.includes('dark:text-emerald-300')).toBe(true);
    expect(reconcileCode.includes('dark:text-sky-300')).toBe(true);
    expect(reconcileCode.includes('dark:text-purple-300')).toBe(true);
    expect(reconcileCode.includes('dark:text-amber-300')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     2. Feature 18: SVG Donut Chart Stroke & RootErrorBoundary Dark Mode
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.4: SVG Donut Chart separator stroke harmonizes with dark mode theme token', () => {
    const chartCode = readProjectFile('src/components/AnalyticsCharts.tsx');

    expect(chartCode.includes('stroke-[var(--card)]')).toBe(true);
    expect(chartCode.includes('stroke="var(--card, #FFFFFF)"')).toBe(true);
  });

  it('M3.5: RootErrorBoundary provides styled dark mode UI and 44px retry targets', () => {
    const mainCode = readProjectFile('src/main.tsx');

    expect(mainCode.includes('dark:bg-slate-950')).toBe(true);
    expect(mainCode.includes('dark:bg-slate-900')).toBe(true);
    expect(mainCode.includes('dark:text-slate-100')).toBe(true);
    expect(mainCode.includes('min-h-[44px]')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     3. Feature 19: Dynamic Meta Theme Color & Viewport Cover
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.6: index.html includes viewport-fit=cover and fallback theme-color tags', () => {
    const indexHtml = readProjectFile('index.html');

    expect(indexHtml.includes('viewport-fit=cover')).toBe(true);
    expect(indexHtml.includes('meta name="theme-color"')).toBe(true);
  });

  it('M3.7: themeService dynamically synchronizes meta theme-color with active background', () => {
    const themeService = readProjectFile('src/utils/themeService.ts');

    expect(themeService.includes('metaTags.forEach((meta) => {')).toBe(true);
    expect(themeService.includes("meta.setAttribute('content', themeColor);")).toBe(true);
    expect(themeService.includes('#ffffff')).toBe(true);
    expect(themeService.includes('#0f172a')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     4. Feature 20 & 22: Mobile Safe Areas & Touch Target Expansion (>= 44px)
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.8: Mobile bottom nav includes safe area inset padding and >= 44x44px touch targets', () => {
    const appCode = readProjectFile('src/App.tsx');

    // Safe area bottom inset on fixed bottom nav
    expect(appCode.includes('pb-[max(0.375rem,env(safe-area-inset-bottom))]')).toBe(true);

    // Bottom tab touch dimensions
    expect(appCode.includes('min-h-[44px] min-w-[48px]')).toBe(true);

    // Floating add button touch dimensions
    expect(appCode.includes('min-h-[44px] min-w-[44px]')).toBe(true);
  });

  it('M3.9: Header action buttons provide minimum 44x44px touch targets', () => {
    const appCode = readProjectFile('src/App.tsx');

    // Palette, Theme, Privacy, Report, Lock buttons in header
    expect(appCode.includes('min-h-[44px] min-w-[44px]')).toBe(true);
    expect(appCode.includes('kinlo-btn-primary min-h-[44px]')).toBe(true);
  });

  it('M3.10: Transaction ledger mobile row actions have >= 38px height and distinct spacing', () => {
    const tableCode = readProjectFile('src/components/TransactionLedgerTable.tsx');

    // Mobile edit/delete buttons
    expect(tableCode.includes('min-h-[38px] px-3.5')).toBe(true);
    expect(tableCode.includes('gap-3')).toBe(true);
    expect(tableCode.includes('aria-label={`Chỉnh sửa giao dịch: ${rec.purchaseItem}`}')).toBe(true);
    expect(tableCode.includes('aria-label={`Xóa giao dịch: ${rec.purchaseItem}`}')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     5. Feature 21: Modal Centering & Short Viewport Overflow Fix
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.11: Modals use items-start sm:items-center to prevent top header clipping on small screens', () => {
    const addModal = readProjectFile('src/components/AddTransactionModal.tsx');
    const editModal = readProjectFile('src/components/EditTransactionModal.tsx');
    const reportModal = readProjectFile('src/components/MonthlyReportCardModal.tsx');
    const pwaModal = readProjectFile('src/components/PwaInstallModal.tsx');

    expect(addModal.includes('items-start sm:items-center')).toBe(true);
    expect(editModal.includes('items-start sm:items-center')).toBe(true);
    expect(reportModal.includes('items-start sm:items-center')).toBe(true);
    expect(pwaModal.includes('items-start sm:items-center')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     6. Feature 23: Comprehensive ARIA & Keyboard Accessibility
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.12: Modals implement WAI-ARIA dialog semantics (role="dialog", aria-modal, aria-labelledby)', () => {
    const addModal = readProjectFile('src/components/AddTransactionModal.tsx');
    const editModal = readProjectFile('src/components/EditTransactionModal.tsx');
    const reportModal = readProjectFile('src/components/MonthlyReportCardModal.tsx');
    const pwaModal = readProjectFile('src/components/PwaInstallModal.tsx');

    expect(addModal.includes('role="dialog"')).toBe(true);
    expect(addModal.includes('aria-modal="true"')).toBe(true);
    expect(addModal.includes('aria-labelledby="add-tx-modal-title"')).toBe(true);

    expect(editModal.includes('role="dialog"')).toBe(true);
    expect(editModal.includes('aria-modal="true"')).toBe(true);
    expect(editModal.includes('aria-labelledby="edit-tx-modal-title"')).toBe(true);

    expect(reportModal.includes('role="dialog"')).toBe(true);
    expect(reportModal.includes('aria-modal="true"')).toBe(true);
    expect(reportModal.includes('aria-labelledby="monthly-report-modal-title"')).toBe(true);

    expect(pwaModal.includes('role="dialog"')).toBe(true);
    expect(pwaModal.includes('aria-modal="true"')).toBe(true);
    expect(pwaModal.includes('aria-labelledby="pwa-install-title"')).toBe(true);
  });

  it('M3.13: KinloBankAccountsCard and CalendarHeatmapView implement keyboard accessibility and ARIA roles', () => {
    const bankCode = readProjectFile('src/components/KinloBankAccountsCard.tsx');
    expect(bankCode.includes('role="button"')).toBe(true);
    expect(bankCode.includes('tabIndex={0}')).toBe(true);
    expect(bankCode.includes("e.key === 'Enter' || e.key === ' '")).toBe(true);
    expect(bankCode.includes('aria-label="Chi tiết chu kỳ Ví BE Corp')).toBe(true);

    const calCode = readProjectFile('src/components/CalendarHeatmapView.tsx');
    expect(calCode.includes('role="button"')).toBe(true);
    expect(calCode.includes('tabIndex={0}')).toBe(true);
    expect(calCode.includes("e.key === 'Enter' || e.key === ' '")).toBe(true);
    expect(calCode.includes('aria-label="Đóng chi tiết ngày"')).toBe(true);
  });

  it('M3.14: Icon-only buttons and controls have accessible aria-labels', () => {
    const appCode = readProjectFile('src/App.tsx');
    expect(appCode.includes('aria-label="Khóa ứng dụng an toàn"')).toBe(true);
    expect(appCode.includes('aria-label="Thêm giao dịch mới"')).toBe(true);
    expect(appCode.includes('aria-label="Trang chủ Dashboard"')).toBe(true);
    expect(appCode.includes('aria-label="Sổ cái giao dịch"')).toBe(true);
    expect(appCode.includes('aria-label="Đối soát ví & thẻ"')).toBe(true);
    expect(appCode.includes('aria-label="Đồng bộ Google Sheets"')).toBe(true);

    const cashflowCode = readProjectFile('src/components/KinloCashflowCard.tsx');
    expect(cashflowCode.includes('aria-label="Xem chi tiết sổ giao dịch"')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     7. Feature 24: Shimmer Skeleton Fallbacks
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.15: Reusable shimmer skeleton loaders are exported and utilized as Suspense fallbacks', () => {
    const skeletonCode = readProjectFile('src/components/SkeletonLoaders.tsx');
    expect(skeletonCode.includes('export const TableSkeletonLoader')).toBe(true);
    expect(skeletonCode.includes('export const ChartSkeletonLoader')).toBe(true);
    expect(skeletonCode.includes('export const ReconcileSkeletonLoader')).toBe(true);
    expect(skeletonCode.includes('export const SheetSyncSkeletonLoader')).toBe(true);

    const appCode = readProjectFile('src/App.tsx');
    expect(appCode.includes('<Suspense fallback={<ChartSkeletonLoader')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<ReconcileSkeletonLoader')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<SheetSyncSkeletonLoader')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<TableSkeletonLoader')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     8. Passbook Monthly Highlight: Biggest Expense Name Fallback
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.16: MonthlyReportCardModal provides robust getBiggestExpenseLabel fallback when purchaseItem is empty', () => {
    const reportModal = readProjectFile('src/components/MonthlyReportCardModal.tsx');
    expect(reportModal.includes('getBiggestExpenseLabel')).toBe(true);
    expect(reportModal.includes('biggestExpenseLabel')).toBe(true);
    expect(reportModal.includes('Món chi lớn nhất:')).toBe(true);
  });

  /* ═════════════════════════════════════════════════════════════════════
     9. Privacy Masking & Header UX Toggle Verification
     ═════════════════════════════════════════════════════════════════════ */
  it('M3.17: TransactionLedgerTable and Header consistently mask toolbar totals and row items with •••••• when Privacy Mode is active', () => {
    const ledgerCode = readProjectFile('src/components/TransactionLedgerTable.tsx');
    expect(ledgerCode.includes('renderToolbarMoney')).toBe(true);
    expect(ledgerCode.includes('isPrivacyActive')).toBe(true);
    expect(ledgerCode.includes('_effectiveIsPrivate')).toBe(true);

    const appCode = readProjectFile('src/App.tsx');
    expect(appCode.includes('Đang ẩn')).toBe(true);
    expect(appCode.includes('Ẩn số')).toBe(true);

    const privacyCode = readProjectFile('src/utils/privacyService.ts');
    expect(privacyCode.includes('let globalPrivacyMode = false;')).toBe(true);
  });
});

// Auto-run if executed directly via tsx/ts-node or node
const isMain =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' && process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('milestone3_ui_ux.test.ts'));

if (isMain) {
  registry.runSuites().then((summaries) => {
    let failed = 0;
    for (const s of summaries) {
      console.log(`\n${s.failed === 0 ? '✓' : '✗'} ${s.suiteName} (${s.passed}/${s.total} passed)`);
      for (const r of s.results) {
        if (r.passed) {
          console.log(`    ✓ ${r.testName}`);
        } else {
          failed++;
          console.log(`    ✗ ${r.testName} - Error: ${r.error?.message}`);
        }
      }
    }
    console.log(`\nResult: ${failed === 0 ? 'ALL M3 TESTS PASSED (100%)' : 'FAILURES OCCURRED'}\n`);
    if (failed > 0) process.exit(1);
  });
}
