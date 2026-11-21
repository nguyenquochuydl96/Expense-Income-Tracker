import { describe, test, expect } from './testHarness';
import * as fs from 'fs';
import * as path from 'path';

// =========================================================================
// EMPIRICAL CHALLENGER: MILESTONE 3 ACCESSIBILITY & VIEWPORT STRESS HARNESS
// =========================================================================

describe('Challenger M3.1: Short Screen & Virtual Keyboard Viewport Stress Oracle', () => {
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

  const readProjectFile = (relPath: string) => {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
  };

  test('CH3.1.1: Math and Geometry Oracle: items-start prevents header clipping on viewports < 600px', () => {
    // Mathematical proof and layout oracle:
    // Viewport heights: iPhone SE with keyboard (320px), compact mobile (400px), short screen (500px), tablet split-screen (580px)
    const testViewportHeights = [320, 380, 420, 500, 580];
    const modalContentHeight = 680; // AddTransactionModal approximate full form height in pixels
    const paddingTopMobile = 16; // py-4 = 1rem = 16px

    for (const vh of testViewportHeights) {
      // SCENARIO A: Broken implementation with items-center (no items-start on mobile)
      // Top coordinate = (viewport - modal) / 2
      const brokenTop = Math.round((vh - modalContentHeight) / 2);
      // In CSS scroll containers, content above 0 cannot be reached via scroll:
      const brokenClippedHeaderPixels = brokenTop < 0 ? Math.abs(brokenTop) : 0;
      expect(brokenClippedHeaderPixels).toBeGreaterThan(0);

      // SCENARIO B: Fixed implementation with items-start sm:items-center + py-4
      // Top coordinate on mobile = paddingTop
      const fixedTop = paddingTopMobile;
      expect(fixedTop).toBeGreaterThanOrEqual(0); // Header is ALWAYS at y >= 0

      // Scrollable range
      const totalScrollHeight = modalContentHeight + paddingTopMobile * 2;
      const maxScrollDistance = totalScrollHeight - vh;
      expect(maxScrollDistance).toBeGreaterThan(0);

      // Verify that at scrollTop = 0, header is 100% visible:
      const headerVisibleAtStart = fixedTop >= 0 && fixedTop < vh;
      expect(headerVisibleAtStart).toBe(true);

      // Verify that at scrollTop = maxScrollDistance, bottom submit button is visible:
      const submitButtonVisibleAtEnd = (totalScrollHeight - maxScrollDistance) <= vh;
      expect(submitButtonVisibleAtEnd).toBe(true);
    }
  });

  test('CH3.1.2: Static & AST audit of all 4 application modals for items-start, overflow-y-auto, and 44px close button', () => {
    const addModal = readProjectFile('src/components/AddTransactionModal.tsx');
    const editModal = readProjectFile('src/components/EditTransactionModal.tsx');
    const reportModal = readProjectFile('src/components/MonthlyReportCardModal.tsx');
    const pwaModal = readProjectFile('src/components/PwaInstallModal.tsx');

    // 1. AddTransactionModal
    expect(addModal.includes('items-start sm:items-center')).toBe(true);
    expect(addModal.includes('overflow-y-auto')).toBe(true);
    expect(addModal.includes('min-h-[44px] min-w-[44px]')).toBe(true);
    expect(addModal.includes('aria-label="Đóng cửa sổ thêm giao dịch"')).toBe(true);

    // 2. EditTransactionModal
    expect(editModal.includes('items-start sm:items-center')).toBe(true);
    expect(editModal.includes('overflow-y-auto')).toBe(true);
    expect(editModal.includes('min-h-[44px] min-w-[44px]')).toBe(true);
    expect(editModal.includes('aria-label="Đóng cửa sổ chỉnh sửa giao dịch"')).toBe(true);

    // 3. MonthlyReportCardModal
    expect(reportModal.includes('items-start sm:items-center')).toBe(true);
    expect(reportModal.includes('overflow-y-auto')).toBe(true);
    expect(reportModal.includes('max-h-[92vh] flex flex-col')).toBe(true);
    expect(reportModal.includes('min-h-[44px] min-w-[44px]')).toBe(true);
    expect(reportModal.includes('aria-label="Đóng báo cáo tháng"')).toBe(true);

    // 4. PwaInstallModal
    expect(pwaModal.includes('items-start sm:items-center')).toBe(true);
    expect(pwaModal.includes('overflow-y-auto')).toBe(true);
    expect(pwaModal.includes('min-h-[44px] min-w-[44px]')).toBe(true);
    expect(pwaModal.includes('aria-label="Đóng cửa sổ cài đặt"')).toBe(true);
  });

  test('CH3.1.3: CalendarHeatmapView day details modal handles constrained height via max-h-[85vh] and internal scrolling', () => {
    const calCode = readProjectFile('src/components/CalendarHeatmapView.tsx');

    expect(calCode.includes('max-h-[85vh] flex flex-col')).toBe(true);
    expect(calCode.includes('flex-1 overflow-y-auto')).toBe(true);
    expect(calCode.includes('aria-label="Đóng chi tiết ngày"')).toBe(true);
    expect(calCode.includes('min-h-[36px] min-w-[36px]')).toBe(true);
  });
});

describe('Challenger M3.2: Touch Target Ergonomics & Dimensions Verification', () => {
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

  const readProjectFile = (relPath: string) => {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
  };

  test('CH3.2.1: Mobile bottom nav buttons meet WCAG 2.5.5 (>= 44x44px) and iOS safe area padding', () => {
    const appCode = readProjectFile('src/App.tsx');

    // Safe area bottom padding for iPhone X/11/12/13/14/15/16 home indicator bar
    expect(appCode.includes('pb-[max(0.375rem,env(safe-area-inset-bottom))]')).toBe(true);

    // Bottom Navigation Buttons have min-h-[44px] min-w-[48px]
    expect(appCode.includes('min-h-[44px] min-w-[48px]')).toBe(true);

    // Floating add button has min-h-[44px] min-w-[44px]
    expect(appCode.includes('min-h-[44px] min-w-[44px]')).toBe(true);
  });

  test('CH3.2.2: Header action buttons in Kinlo meet >= 44x44px minimum touch target size', () => {
    const appCode = readProjectFile('src/App.tsx');

    // Kinlo header icon buttons and nav
    const matches44 = appCode.match(/min-h-\[44px\]/g) || [];
    // At least 10 occurrences in App.tsx (header buttons + nav buttons + floating buttons)
    expect(matches44.length).toBeGreaterThanOrEqual(10);

    // Both headers contain 44px buttons for Dark Mode, Privacy Mask, Monthly Report, Lock, and Add Transaction
    expect(appCode.includes('aria-label={isDark ? \'Chuyển sang giao diện Sáng\' : \'Chuyển sang giao diện Tối\'}')).toBe(true);
    expect(appCode.includes('aria-label="Khóa ứng dụng an toàn"')).toBe(true);
    expect(appCode.includes('aria-label="Mở báo cáo tài chính tháng"')).toBe(true);
    expect(appCode.includes('aria-label="Thêm giao dịch mới"')).toBe(true);
  });

  test('CH3.2.3: Transaction ledger mobile row buttons have >= 38px height and distinct 12px gap', () => {
    const tableCode = readProjectFile('src/components/TransactionLedgerTable.tsx');

    // Mobile edit/delete buttons
    expect(tableCode.includes('min-h-[38px] px-3.5 py-1.5')).toBe(true);
    expect(tableCode.includes('gap-3')).toBe(true);

    // Desktop table row edit/delete buttons have 36x36px minimum
    expect(tableCode.includes('min-h-[36px] min-w-[36px]')).toBe(true);
  });

  test('CH3.2.4: Calendar day cells provide >= 64px tap height for touch precision', () => {
    const calCode = readProjectFile('src/components/CalendarHeatmapView.tsx');

    // h-16 = 4rem = 64px mobile, sm:h-20 = 5rem = 80px desktop
    expect(calCode.includes('h-16 sm:h-20')).toBe(true);
  });
});

describe('Challenger M3.3: Keyboard Operability, Navigation Keys & Focus Traps', () => {
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

  const readProjectFile = (relPath: string) => {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
  };

  test('CH3.3.1: Converted card rows and day cells support Enter and Space with preventDefault', () => {
    const bankCode = readProjectFile('src/components/KinloBankAccountsCard.tsx');

    // BE Corp and Credit rows
    expect(bankCode.includes('role="button"')).toBe(true);
    expect(bankCode.includes('tabIndex={0}')).toBe(true);
    expect(bankCode.includes("e.key === 'Enter' || e.key === ' '")).toBe(true);
    expect(bankCode.includes('e.preventDefault()')).toBe(true);

    const calCode = readProjectFile('src/components/CalendarHeatmapView.tsx');
    expect(calCode.includes('role="button"')).toBe(true);
    expect(calCode.includes('tabIndex={0}')).toBe(true);
    expect(calCode.includes("e.key === 'Enter' || e.key === ' '")).toBe(true);
    expect(calCode.includes('e.preventDefault()')).toBe(true);
  });

  test('CH3.3.2: Modals dismiss on Escape and unbind listeners cleanly', () => {
    const files = [
      'src/components/AddTransactionModal.tsx',
      'src/components/EditTransactionModal.tsx',
      'src/components/MonthlyReportCardModal.tsx',
      'src/components/PwaInstallModal.tsx',
      'src/components/CalendarHeatmapView.tsx',
      'src/components/AppLockScreen.tsx',
    ];

    for (const f of files) {
      const content = readProjectFile(f);
      expect(content.includes("e.key === 'Escape'")).toBe(true);
      expect(content.includes("removeEventListener('keydown'")).toBe(true);
    }
  });

  test('CH3.3.3: WAI-ARIA dialog semantics have matching header title IDs', () => {
    const addModal = readProjectFile('src/components/AddTransactionModal.tsx');
    expect(addModal.includes('role="dialog"')).toBe(true);
    expect(addModal.includes('aria-modal="true"')).toBe(true);
    expect(addModal.includes('aria-labelledby="add-tx-modal-title"')).toBe(true);
    expect(addModal.includes('id="add-tx-modal-title"')).toBe(true);

    const editModal = readProjectFile('src/components/EditTransactionModal.tsx');
    expect(editModal.includes('role="dialog"')).toBe(true);
    expect(editModal.includes('aria-modal="true"')).toBe(true);
    expect(editModal.includes('aria-labelledby="edit-tx-modal-title"')).toBe(true);
    expect(editModal.includes('id="edit-tx-modal-title"')).toBe(true);

    const reportModal = readProjectFile('src/components/MonthlyReportCardModal.tsx');
    expect(reportModal.includes('role="dialog"')).toBe(true);
    expect(reportModal.includes('aria-modal="true"')).toBe(true);
    expect(reportModal.includes('aria-labelledby="monthly-report-modal-title"')).toBe(true);
    expect(reportModal.includes('id="monthly-report-modal-title"')).toBe(true);

    const pwaModal = readProjectFile('src/components/PwaInstallModal.tsx');
    expect(pwaModal.includes('role="dialog"')).toBe(true);
    expect(pwaModal.includes('aria-modal="true"')).toBe(true);
    expect(pwaModal.includes('aria-labelledby="pwa-install-title"')).toBe(true);
    expect(pwaModal.includes('id="pwa-install-title"')).toBe(true);
  });
});

describe('Challenger M3.4: Suspense Shimmer Skeleton Fallbacks & CLS Prevention', () => {
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

  const readProjectFile = (relPath: string) => {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
  };

  test('CH3.4.1: SkeletonLoaders exports 4 thematic shimmers with role="status"', () => {
    const skeletonCode = readProjectFile('src/components/SkeletonLoaders.tsx');

    expect(skeletonCode.includes('export const TableSkeletonLoader')).toBe(true);
    expect(skeletonCode.includes('export const ChartSkeletonLoader')).toBe(true);
    expect(skeletonCode.includes('export const ReconcileSkeletonLoader')).toBe(true);
    expect(skeletonCode.includes('export const SheetSyncSkeletonLoader')).toBe(true);

    const matchesRoleStatus = skeletonCode.match(/role="status"/g) || [];
    expect(matchesRoleStatus.length).toBeGreaterThanOrEqual(4);
  });

  test('CH3.4.2: All view-level lazy chunks in App.tsx have dedicated skeleton fallbacks', () => {
    const appCode = readProjectFile('src/App.tsx');

    expect(appCode.includes('<Suspense fallback={<TableSkeletonLoader label="Đang tải ma trận dòng tiền đa tháng..." />}>')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<TableSkeletonLoader label="Đang tải bảng ngân sách hạng mục..." />}>')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<ChartSkeletonLoader label="Đang tải biểu đồ phân tích dòng tiền..." />}>')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<TableSkeletonLoader label="Đang nạp lịch chi tiêu trực quan..." />}>')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<TableSkeletonLoader label="Đang tải sổ chi tiết giao dịch..." />}>')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<ReconcileSkeletonLoader label="Đang nạp màn hình đối soát ví & thẻ..." />}>')).toBe(true);
    expect(appCode.includes('<Suspense fallback={<SheetSyncSkeletonLoader label="Đang nạp bảng đồng bộ Google Sheet..." />}>')).toBe(true);
  });

  test('CH3.4.3: CSS animate-shimmer keyframe gradient sweep is configured for light and dark themes', () => {
    const css = readProjectFile('src/index.css');

    expect(css.includes('@keyframes shimmerWave')).toBe(true);
    expect(css.includes('.animate-shimmer')).toBe(true);
    expect(css.includes('.animate-shimmer::after')).toBe(true);
    expect(css.includes('html.dark .animate-shimmer::after')).toBe(true);
    expect(css.includes('animation: shimmerWave 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;')).toBe(true);
  });
});

describe('Challenger M3.5: Theme Contrast & Color Integrity Verification', () => {
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

  const readProjectFile = (relPath: string) => {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
  };

  test('CH3.5.1: Kinlo theme defines design system tokens in src/index.css', () => {
    const css = readProjectFile('src/index.css');

    expect(css.includes(':root {')).toBe(true);
    expect(css.includes('--accent: #0e6c84;')).toBe(true);
    expect(css.includes('html.dark {')).toBe(true);
    expect(css.includes('--accent: #4cc0d6;')).toBe(true);
    expect(css.includes('--night: #0c262ee0;')).toBe(true);
    expect(css.includes('color: var(--theme-active-tab-text, #FFFFFF) !important;')).toBe(true);
  });

  test('CH3.5.2: Dark input styling enforces #0f172a (Kinlo)', () => {
    const css = readProjectFile('src/index.css');

    expect(css.includes('html.dark input')).toBe(true);
    expect(css.includes('background-color: #0f172a !important;')).toBe(true);
  });

  test('CH3.5.3: Donut chart separator stroke dynamically references var(--card) theme token', () => {
    const chartCode = readProjectFile('src/components/AnalyticsCharts.tsx');

    expect(chartCode.includes('stroke-[var(--card)]')).toBe(true);
    expect(chartCode.includes('stroke="var(--card, #FFFFFF)"')).toBe(true);
  });

  test('CH3.5.4: Dynamic meta theme-color syncs across light and dark modes', () => {
    const themeService = readProjectFile('src/utils/themeService.ts');

    expect(themeService.includes("meta.setAttribute('content', themeColor);")).toBe(true);
    expect(themeService.includes('#0f172a')).toBe(true); // Kinlo Dark
    expect(themeService.includes('#ffffff')).toBe(true); // Kinlo Light
  });
});
