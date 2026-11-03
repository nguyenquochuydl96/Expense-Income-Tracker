import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Check, RotateCcw, Sparkles, CheckSquare, Square, X } from 'lucide-react';

export interface MultiMonthPickerDropdownProps {
  availableMonths: string[]; // e.g. ['2026-10', '2026-09', ...]
  selectedMonths: string[];  // e.g. ['2026-10'] or ['2026-08', '2026-09', '2026-10']
  onChange: (newMonths: string[]) => void;
  monthRecordCounts?: Record<string, number>;
  totalRecordCount?: number;
}

export function formatSelectedMonthsDisplay(selectedMonths: string[], availableMonths: string[]): {
  title: string;
  subtitle?: string;
  badge?: string;
  isAll: boolean;
} {
  const isAll =
    selectedMonths.length === 0 ||
    selectedMonths.includes('ALL') ||
    (availableMonths.length > 0 && selectedMonths.length >= availableMonths.length);

  if (isAll) {
    return {
      title: 'Tất cả các tháng',
      subtitle: 'Toàn bộ thời gian',
      isAll: true,
    };
  }

  if (selectedMonths.length === 1) {
    const [y, m] = selectedMonths[0].split('-');
    const mNum = parseInt(m, 10);
    return {
      title: `Tháng ${mNum}, ${y}`,
      subtitle: `01/${m} – Hết tháng`,
      isAll: false,
    };
  }

  // Sort chronological for display
  const sorted = [...selectedMonths].sort();
  const labels = sorted.map((mk) => {
    const [, m] = mk.split('-');
    return `T${parseInt(m, 10)}`;
  });

  return {
    title: `${selectedMonths.length} tháng: ${labels.join(', ')}`,
    subtitle: `${labels[0]} → ${labels[labels.length - 1]}`,
    badge: `${selectedMonths.length} tháng`,
    isAll: false,
  };
}

export const MultiMonthPickerDropdown: React.FC<MultiMonthPickerDropdownProps> = ({
  availableMonths,
  selectedMonths,
  onChange,
  monthRecordCounts = {},
  totalRecordCount = 0,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAllSelected = useMemo(() => {
    return (
      selectedMonths.length === 0 ||
      selectedMonths.includes('ALL') ||
      (availableMonths.length > 0 && selectedMonths.length >= availableMonths.length)
    );
  }, [selectedMonths, availableMonths]);

  // Handle outside click to close popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const display = useMemo(() => {
    return formatSelectedMonthsDisplay(selectedMonths, availableMonths);
  }, [selectedMonths, availableMonths]);

  // Toggle single month in multi-selection
  const handleToggleMonth = (mKey: string) => {
    if (isAllSelected) {
      // If previously all were selected, unchecking this one keeps all OTHER months
      const remaining = availableMonths.filter((m) => m !== mKey);
      onChange(remaining.length > 0 ? remaining : [availableMonths[0]]);
      return;
    }

    if (selectedMonths.includes(mKey)) {
      // Unticking
      const next = selectedMonths.filter((m) => m !== mKey);
      if (next.length === 0) {
        // If unchecking the last month, fallback to all months
        onChange(availableMonths);
      } else {
        onChange(next);
      }
    } else {
      // Ticking
      const next = [...selectedMonths, mKey];
      if (next.length >= availableMonths.length) {
        onChange(availableMonths);
      } else {
        onChange(next);
      }
    }
  };

  // Select only this single month
  const handleSelectOnly = (mKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([mKey]);
  };

  // Quick presets
  const handleSelectAll = () => {
    onChange(availableMonths);
  };

  const handleSelectLatest = () => {
    if (availableMonths.length > 0) {
      onChange([availableMonths[0]]);
    }
  };

  const handleSelectLast3Months = () => {
    if (availableMonths.length > 0) {
      onChange(availableMonths.slice(0, 3));
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-200"
        title="Bấm để tick chọn một hoặc nhiều tháng"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span className="font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
          {display.title}
        </span>
        {display.badge && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold border border-sky-300/60 dark:border-sky-700/60">
            {display.badge}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform ${
            isOpen ? 'rotate-180 text-sky-600' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="p-3 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>Lọc theo tháng (Chọn nhiều)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
                title="Đóng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Action Chips */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold flex-wrap">
              <button
                type="button"
                onClick={handleSelectAll}
                className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  isAllSelected
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Tất cả các tháng
              </button>

              <button
                type="button"
                onClick={handleSelectLatest}
                className="px-2 py-0.5 rounded-md border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tháng mới nhất
              </button>

              {availableMonths.length >= 3 && (
                <button
                  type="button"
                  onClick={handleSelectLast3Months}
                  className="px-2 py-0.5 rounded-md border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  3 tháng gần nhất
                </button>
              )}
            </div>
          </div>

          {/* Month Checkbox List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-1">
            {availableMonths.map((mKey) => {
              const [y, m] = mKey.split('-');
              const isChecked = isAllSelected || selectedMonths.includes(mKey);
              const count = monthRecordCounts[mKey];

              return (
                <div
                  key={mKey}
                  onClick={() => handleToggleMonth(mKey)}
                  className={`group px-3 py-2 flex items-center justify-between text-xs rounded-lg cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-sky-50/70 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by container onClick
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-slate-600 cursor-pointer pointer-events-none"
                    />
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>Tháng {parseInt(m, 10)}, {y}</span>
                        {mKey === availableMonths[0] && (
                          <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Hiện tại
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-tabular">
                        01/{m} – Hết tháng
                        {count !== undefined && ` · ${count} giao dịch`}
                      </div>
                    </div>
                  </div>

                  {/* "Chỉ chọn" button on hover */}
                  <button
                    type="button"
                    onClick={(e) => handleSelectOnly(mKey, e)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/60 dark:text-sky-200 rounded transition-all cursor-pointer whitespace-nowrap shrink-0"
                    title={`Chỉ xem riêng Tháng ${parseInt(m, 10)}/${y}`}
                  >
                    Chỉ xem
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              {isAllSelected ? (
                <>Đang chọn: <strong>Tất cả ({availableMonths.length} tháng)</strong></>
              ) : (
                <>Đã chọn: <strong>{selectedMonths.length} / {availableMonths.length} tháng</strong></>
              )}
            </span>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
