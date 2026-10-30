import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Flame,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Wallet,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';

export interface DailyCategoryStat {
  category: string;
  effectiveBudget: number;
  spent: number;
  remaining: number;
  percentage: number;
  txCount: number;
}

export interface DailyLivingRunwayWidgetProps {
  selectedMonth: string;
  items: DailyCategoryStat[];
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
}

const STORAGE_KEY_LIVING_CATS = 'heomeo_daily_living_categories_v1';
const STORAGE_KEY_COLLAPSED = 'heomeo_runway_collapsed_v1';

// Mặc định 4 danh mục phát sinh thường nhật hàng ngày (sắp xếp theo alphabet)
const DEFAULT_LIVING_CATEGORIES = [
  'Ăn uống',
  'Giải trí Heo',
  'Giải trí Mèo',
  'Hóa/Mỹ phẩm',
];

export const DailyLivingRunwayWidget: React.FC<DailyLivingRunwayWidgetProps> = ({
  selectedMonth,
  items,
  onSelectCategory,
  selectedCategory = 'ALL',
}) => {
  // State: Danh sách danh mục được chọn làm "Hằng ngày"
  const [livingCategories, setLivingCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LIVING_CATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_LIVING_CATEGORIES;
  });

  // State: Thu gọn / mở rộng widget
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  });

  // State: Modal cấu hình danh mục hằng ngày
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [tempLivingCats, setTempLivingCats] = useState<string[]>(livingCategories);

  // Sync livingCategories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LIVING_CATS, JSON.stringify(livingCategories));
    } catch {
      // ignore
    }
  }, [livingCategories]);

  // Sync collapsed state to localStorage
  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Tính toán thông tin ngày tháng trong kỳ
  const dateMetrics = useMemo(() => {
    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : '2026-10';
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let currentDay: number;
    let isPast = false;
    let isFuture = false;

    if (targetMonth === currentYearMonth) {
      currentDay = now.getDate();
    } else if (targetMonth < currentYearMonth) {
      currentDay = daysInMonth;
      isPast = true;
    } else {
      currentDay = 1;
      isFuture = true;
    }

    const elapsedDays = isPast ? daysInMonth : Math.max(1, currentDay);
    const remainingDays = isPast ? 0 : Math.max(1, daysInMonth - currentDay + 1);

    return {
      year,
      month,
      daysInMonth,
      currentDay,
      elapsedDays,
      remainingDays,
      isPast,
      isFuture,
      isCurrentMonth: targetMonth === currentYearMonth,
    };
  }, [selectedMonth]);

  // Phân tách items thành: Nhóm Hằng ngày vs Nhóm Định kỳ / Đột xuất (sắp xếp theo alphabet từ trái sang phải)
  const { dailyItems, periodicItems } = useMemo(() => {
    const livingSet = new Set(livingCategories);
    const daily: DailyCategoryStat[] = [];
    const periodic: DailyCategoryStat[] = [];

    items.forEach((item) => {
      if (livingSet.has(item.category)) {
        daily.push(item);
      } else {
        periodic.push(item);
      }
    });

    // Sắp xếp thứ tự từ trái sang phải theo alphabet tiếng Việt
    daily.sort((a, b) => a.category.localeCompare(b.category, 'vi'));
    periodic.sort((a, b) => a.category.localeCompare(b.category, 'vi'));

    return { dailyItems: daily, periodicItems: periodic };
  }, [items, livingCategories]);

  // Tính toán tổng hợp cho nhóm Hằng ngày
  const summary = useMemo(() => {
    const totalBudget = dailyItems.reduce((s, i) => s + i.effectiveBudget, 0);
    const totalSpent = dailyItems.reduce((s, i) => s + i.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const pctUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const { elapsedDays, remainingDays, isPast } = dateMetrics;

    const burnRateDaily = elapsedDays > 0 ? Math.round(totalSpent / elapsedDays) : 0;
    const safeDailyAllowance =
      remainingDays > 0 ? Math.max(0, Math.round(totalRemaining / remainingDays)) : 0;

    const diff = safeDailyAllowance - burnRateDaily;
    const isPacingSafe = diff >= 0 || isPast;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      pctUsed,
      burnRateDaily,
      safeDailyAllowance,
      diff,
      isPacingSafe,
    };
  }, [dailyItems, dateMetrics]);

  // Handlers modal setting
  const openSettings = () => {
    setTempLivingCats([...livingCategories]);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    if (tempLivingCats.length === 0) {
      setLivingCategories(['Ăn uống']);
    } else {
      setLivingCategories([...tempLivingCats]);
    }
    setIsSettingsOpen(false);
  };

  const handleResetDefaultSettings = () => {
    setTempLivingCats(DEFAULT_LIVING_CATEGORIES);
  };

  const toggleCategoryInTemp = (cat: string) => {
    if (tempLivingCats.includes(cat)) {
      setTempLivingCats(tempLivingCats.filter((c) => c !== cat));
    } else {
      setTempLivingCats([...tempLivingCats, cat]);
    }
  };

  return (
    <div className="mb-5 bg-gradient-to-br from-indigo-900/5 via-teal-900/5 to-slate-100/50 rounded-2xl border border-indigo-100/80 p-4 sm:p-5 shadow-xs transition-all">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-100/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-2xs">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>Dự Báo Chi Tiêu Hằng Ngày &amp; Hạn Mức An Toàn</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {dailyItems.length} danh mục thường nhật
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>
                {dateMetrics.isPast ? (
                  `Tháng ${dateMetrics.month}/${dateMetrics.year} đã kết thúc (${dateMetrics.daysInMonth} ngày).`
                ) : dateMetrics.isFuture ? (
                  `Tháng ${dateMetrics.month}/${dateMetrics.year} chưa bắt đầu (${dateMetrics.daysInMonth} ngày).`
                ) : (
                  <>
                    Hôm nay ngày <strong>{dateMetrics.currentDay}/{dateMetrics.month}</strong> · Đã qua <strong>{dateMetrics.elapsedDays}/{dateMetrics.daysInMonth}</strong> ngày · Còn lại <strong>{dateMetrics.remainingDays}</strong> ngày
                  </>
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-indigo-700 bg-white hover:bg-indigo-50/60 rounded-lg border border-slate-200 shadow-2xs transition-colors"
            title="Tùy chọn danh mục tính vào chi tiêu hằng ngày"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Chọn danh mục</span>
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white rounded-lg border border-slate-200 shadow-2xs transition-colors"
          >
            {isCollapsed ? (
              <>
                <span>Mở rộng</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content (when expanded) */}
      {!isCollapsed ? (
        <div className="pt-4 space-y-4">
          {/* Hero 3 Cards Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Safe Daily Allowance */}
            <div className="p-3.5 rounded-xl bg-white border border-teal-200/80 shadow-2xs flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-teal-800 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-teal-600" />
                  <span>Hạn mức an toàn hôm nay:</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  {dateMetrics.remainingDays > 0 ? `${dateMetrics.remainingDays} ngày tới` : 'Hết kỳ'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-teal-700 font-mono-tabular tracking-tight my-0.5">
                {formatCurrency(summary.safeDailyAllowance)}
                <span className="text-xs font-semibold text-teal-600"> /ngày</span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                <span>Ngân sách còn: {formatCurrency(summary.totalRemaining)}</span>
                <span className="text-[10px] text-slate-400">cả nhà</span>
              </div>
            </div>

            {/* Card 2: Actual Burn Rate */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-700 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tốc độ tiêu thực tế:</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  {dateMetrics.elapsedDays} ngày qua
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono-tabular tracking-tight my-0.5">
                {formatCurrency(summary.burnRateDaily)}
                <span className="text-xs font-semibold text-slate-500"> /ngày</span>
              </div>
              <div className="text-[11px] pt-1 border-t border-slate-100 flex items-center justify-between">
                {summary.isPacingSafe ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Dưới hạn mức an toàn ({formatCurrency(Math.abs(summary.diff))})</span>
                  </span>
                ) : (
                  <span className="text-rose-700 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>Vượt nhịp độ an toàn ({formatCurrency(Math.abs(summary.diff))})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Card 3: Combined Living Budget Progress */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-700 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Tiến độ quỹ thường nhật:</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {summary.pctUsed.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-1.5 my-1">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      summary.pctUsed > 100
                        ? 'bg-rose-500'
                        : summary.pctUsed > 85
                        ? 'bg-amber-500'
                        : 'bg-teal-500'
                    }`}
                    style={{ width: `${Math.min(100, summary.pctUsed)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular">
                  <span>Đã chi: {formatCurrency(summary.totalSpent)}</span>
                  <span>Tổng quỹ: {formatCurrency(summary.totalBudget)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 text-right">
                Gồm: {dailyItems.map((i) => i.category).join(', ')}
              </div>
            </div>
          </div>

          {/* Grid of Individual Daily Living Categories */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>Chi tiết từng quỹ sinh hoạt hằng ngày:</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Bấm vào thẻ để lọc danh sách chi tiêu bên dưới
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {dailyItems.map((item) => {
                const { elapsedDays, remainingDays, daysInMonth, currentDay } = dateMetrics;
                const burnRate = elapsedDays > 0 ? Math.round(item.spent / elapsedDays) : 0;
                const safeDaily =
                  remainingDays > 0 ? Math.max(0, Math.round(item.remaining / remainingDays)) : 0;

                // Trạng thái dự báo
                let statusBadge: {
                  type: 'danger' | 'warning' | 'safe' | 'unspent';
                  label: string;
                  runwayText: string;
                };

                if (item.remaining <= 0) {
                  statusBadge = {
                    type: 'danger',
                    label: 'Đã bội chi',
                    runwayText: `Âm ${formatCurrency(Math.abs(item.remaining))}`,
                  };
                } else if (burnRate <= 0) {
                  statusBadge = {
                    type: 'unspent',
                    label: 'Chưa phát sinh',
                    runwayText: 'Còn nguyên ngân sách',
                  };
                } else if (burnRate > safeDaily && safeDaily > 0) {
                  const daysLeftAtBurn = item.remaining / burnRate;
                  const burnoutDay = Math.min(daysInMonth, Math.floor(currentDay + daysLeftAtBurn));
                  statusBadge = {
                    type: 'warning',
                    label: 'Nguy cơ cạn sớm',
                    runwayText: `Dự kiến cạn ngày ${burnoutDay}/${dateMetrics.month}`,
                  };
                } else {
                  statusBadge = {
                    type: 'safe',
                    label: 'An toàn đến cuối tháng',
                    runwayText: `Thặng dư dự kiến: +${formatCurrency(
                      Math.max(0, item.remaining - burnRate * remainingDays)
                    )}`,
                  };
                }

                const isSelected = selectedCategory === item.category;

                return (
                  <div
                    key={item.category}
                    onClick={() => onSelectCategory && onSelectCategory(isSelected ? 'ALL' : item.category)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-500 shadow-sm ring-2 ring-teal-400/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top: Category Badge & Status */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <CategoryBadge category={item.category} />
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                            statusBadge.type === 'danger'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : statusBadge.type === 'warning'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : statusBadge.type === 'safe'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Remaining vs Safe daily */}
                      <div className="space-y-1 font-mono-tabular">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-slate-500">Còn lại:</span>
                          <span
                            className={`text-sm font-bold ${
                              item.remaining < 0 ? 'text-rose-600' : 'text-slate-800'
                            }`}
                          >
                            {formatCurrency(item.remaining)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-teal-700 font-medium">Tiêu tối đa:</span>
                          <span className="text-xs font-bold text-teal-700">
                            {formatCurrency(safeDaily)}
                            <span className="text-[10px] font-normal">/ngày</span>
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-slate-400 text-[10px]">
                          <span>Tốc độ đã qua:</span>
                          <span>{formatCurrency(burnRate)}/ngày</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Forecast Note */}
                    <div
                      className={`mt-2 pt-1.5 border-t text-[10px] font-medium leading-tight ${
                        statusBadge.type === 'danger'
                          ? 'border-rose-100 text-rose-700'
                          : statusBadge.type === 'warning'
                          ? 'border-amber-100 text-amber-700'
                          : statusBadge.type === 'safe'
                          ? 'border-emerald-100 text-emerald-700'
                          : 'border-slate-100 text-slate-500'
                      }`}
                    >
                      {statusBadge.runwayText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Non-daily Categories Strip (Khoản Định kỳ & Sự kiện đột xuất) */}
          {periodicItems.length > 0 && (
            <div className="pt-2 border-t border-indigo-100/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2 font-medium">
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
                <span>Các khoản Định kỳ &amp; Sự kiện đột xuất (không chia theo ngày):</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {periodicItems.map((item) => {
                  const isSelected = selectedCategory === item.category;
                  const isFinished = item.spent > 0 && item.remaining >= 0 && item.spent >= item.effectiveBudget * 0.9;
                  return (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => onSelectCategory && onSelectCategory(isSelected ? 'ALL' : item.category)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular border transition-all ${
                        isSelected
                          ? 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                      }`}
                    >
                      <span className="font-sans font-medium text-slate-800">{item.category}:</span>
                      {isFinished ? (
                        <span className="text-emerald-700 font-bold">Đã chi trả</span>
                      ) : (
                        <span className={item.remaining < 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          Còn {formatCurrency(item.remaining)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Collapsed compact view: just 1 line summary */
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
          <div className="flex items-center gap-2">
            <span className="text-teal-800 font-semibold">⚡ Hạn mức hôm nay:</span>
            <span className="font-black text-teal-700 text-sm">
              {formatCurrency(summary.safeDailyAllowance)} / ngày
            </span>
            <span className="text-slate-500 font-sans text-[11px]">
              (Còn lại {formatCurrency(summary.totalRemaining)} cho {dailyItems.length} quỹ thường nhật)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {summary.isPacingSafe ? (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                🟢 Nhịp độ an toàn
              </span>
            ) : (
              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold">
                ⚠️ Cần giảm tốc độ chi
              </span>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal (Tùy chọn danh mục tính vào chi tiêu hằng ngày) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Cấu hình Danh mục Chi Tiêu Hằng Ngày
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Chọn các quỹ bạn muốn chia hạn mức và tính tốc độ tiêu mỗi ngày
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Checkbox list (sắp xếp theo alphabet) */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {[...items].sort((a, b) => a.category.localeCompare(b.category, 'vi')).map((item) => {
                const isChecked = tempLivingCats.includes(item.category);
                return (
                  <label
                    key={item.category}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-semibold'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategoryInTemp(item.category)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <CategoryBadge category={item.category} />
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-500">
                      Ngân sách: {formatCurrency(item.effectiveBudget)}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
              <button
                type="button"
                onClick={handleResetDefaultSettings}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mặc định</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Áp dụng ({tempLivingCats.length} mục)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
