import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Tag,
  ChevronDown,
  X,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Utensils,
} from 'lucide-react';
import { CategoryBadge } from '../utils/categoryIcons';
import { CATEGORY_COLORS } from '../types/finance';
import { formatCurrency } from '../utils/csvParser';
import { motion, AnimatePresence } from 'motion/react';

export interface MultiCategoryPickerDropdownProps {
  allCategories: string[];          // e.g. ['Ăn uống', 'Thuê nhà', 'Tiết kiệm', ...]
  selectedCategories: string[];    // e.g. [] or ['ALL'] for all, or ['Ăn uống', 'Shopping']
  onChange: (newCategories: string[]) => void;
  categoryRecordCounts?: Record<string, number>;
  categorySpentTotals?: Record<string, number>;
  totalRecordCount?: number;
}

export function formatSelectedCategoriesDisplay(
  selectedCategories: string[],
  allCategories: string[]
): {
  title: string;
  badge?: string;
  isAll: boolean;
  selectedCategoryName?: string;
} {
  const isAll =
    selectedCategories.length === 0 ||
    selectedCategories.includes('ALL') ||
    (allCategories.length > 0 && selectedCategories.length >= allCategories.length);

  if (isAll) {
    return {
      title: 'Tất cả danh mục (Category)',
      isAll: true,
    };
  }

  if (selectedCategories.length === 1) {
    const cat = selectedCategories[0];
    return {
      title: cat,
      selectedCategoryName: cat,
      isAll: false,
    };
  }

  if (selectedCategories.length === 2) {
    return {
      title: `${selectedCategories[0]}, ${selectedCategories[1]}`,
      badge: '2 DM',
      isAll: false,
    };
  }

  return {
    title: `${selectedCategories.length} danh mục: ${selectedCategories.slice(0, 2).join(', ')}...`,
    badge: `${selectedCategories.length} DM`,
    isAll: false,
  };
}

export const MultiCategoryPickerDropdown: React.FC<MultiCategoryPickerDropdownProps> = ({
  allCategories,
  selectedCategories,
  onChange,
  categoryRecordCounts = {},
  categorySpentTotals = {},
  totalRecordCount = 0,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  const isAllSelected = useMemo(() => {
    return (
      selectedCategories.length === 0 ||
      selectedCategories.includes('ALL') ||
      (allCategories.length > 0 && selectedCategories.length >= allCategories.length)
    );
  }, [selectedCategories, allCategories]);

  // Handle outside click & escape key to close popover
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
    return formatSelectedCategoriesDisplay(selectedCategories, allCategories);
  }, [selectedCategories, allCategories]);

  // Toggle single category in multi-selection
  const handleToggleCategory = (cat: string) => {
    if (isAllSelected) {
      // If previously all were selected, unchecking this one keeps all OTHER categories
      const remaining = allCategories.filter((c) => c !== cat);
      onChange(remaining.length > 0 ? remaining : [allCategories[0]]);
      return;
    }

    if (selectedCategories.includes(cat)) {
      // Unticking
      const next = selectedCategories.filter((c) => c !== cat);
      if (next.length === 0) {
        // If unchecking the last category, fallback to all categories
        onChange(allCategories);
      } else {
        onChange(next);
      }
    } else {
      // Ticking
      const next = [...selectedCategories, cat];
      if (next.length >= allCategories.length) {
        onChange(allCategories);
      } else {
        onChange(next);
      }
    }
  };

  // Select only this single category (isolation)
  const handleSelectOnly = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([cat]);
  };

  // Quick presets
  const handleSelectAll = () => {
    onChange(allCategories);
  };

  const handleSelectLivingExpensesOnly = () => {
    // Select all except Tiết kiệm / Tích lũy
    const living = allCategories.filter(
      (c) =>
        c !== 'Tiết kiệm' &&
        !c.toLowerCase().includes('tiết kiệm') &&
        !c.toLowerCase().includes('tích lũy')
    );
    onChange(living.length > 0 ? living : allCategories);
  };

  const handleClearAll = () => {
    // Clear to first category so filter isn't empty
    if (allCategories.length > 0) {
      onChange([allCategories[0]]);
    }
  };

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCategories;
    return allCategories.filter((cat) => cat.toLowerCase().includes(q));
  }, [allCategories, searchQuery]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-2xs transition-all cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-100 theme-filter-trigger"
        title="Bấm để tick chọn một hoặc nhiều danh mục"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span className="font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap max-w-[200px] sm:max-w-[240px] truncate">
          {display.title}
        </span>
        {display.badge && (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold border border-indigo-300/60 dark:border-indigo-700/60 shrink-0">
            {display.badge}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-84 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
          >
            {/* Header */}
          <div className="p-3 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Lọc theo danh mục (Chọn nhiều)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm nhanh danh mục..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Action Chips */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold flex-wrap">
              <button
                type="button"
                onClick={handleSelectAll}
                className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  isAllSelected
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Tất cả ({allCategories.length})
              </button>

              <button
                type="button"
                onClick={handleSelectLivingExpensesOnly}
                className="px-2 py-0.5 rounded-md border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Chọn tất cả danh mục trừ Tiết kiệm"
              >
                Chỉ sinh hoạt
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-0.5 rounded-md border bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-[10px]"
                title="Bỏ chọn nhanh để chọn lẻ từng danh mục"
              >
                Chọn 1 mục lẻ
              </button>
            </div>
          </div>

          {/* Category Checkbox List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-1">
            {filteredCategories.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                Không tìm thấy danh mục nào khớp với "{searchQuery}"
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isChecked = isAllSelected || selectedCategories.includes(cat);
                const count = categoryRecordCounts[cat];
                const spent = categorySpentTotals[cat];
                const catColor = CATEGORY_COLORS[cat] || '#64748B';

                return (
                  <div
                    key={cat}
                    onClick={() => handleToggleCategory(cat)}
                    className={`group px-3 py-2 flex items-center justify-between text-xs rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by container onClick
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer pointer-events-none shrink-0"
                      />
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CategoryBadge category={cat} compact />
                        <span className="font-semibold truncate">{cat}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(count !== undefined || spent !== undefined) && (
                        <div className="text-right text-[11px] font-mono-tabular">
                          {spent !== undefined && spent > 0 && (
                            <div className="font-bold text-slate-700 dark:text-slate-300">
                              {formatCurrency(spent)}
                            </div>
                          )}
                          {count !== undefined && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                              {count} gd
                            </div>
                          )}
                        </div>
                      )}

                      {/* "Chỉ xem" button on hover */}
                      <button
                        type="button"
                        onClick={(e) => handleSelectOnly(cat, e)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-200 rounded transition-all cursor-pointer whitespace-nowrap"
                        title={`Chỉ xem riêng danh mục ${cat}`}
                      >
                        Chỉ xem
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              {isAllSelected ? (
                <>Đang chọn: <strong>Tất cả ({allCategories.length} danh mục)</strong></>
              ) : (
                <>Đã chọn: <strong>{selectedCategories.length} / {allCategories.length} danh mục</strong></>
              )}
            </span>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Áp dụng
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
};
