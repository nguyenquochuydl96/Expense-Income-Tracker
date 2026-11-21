import React from 'react';

interface SkeletonProps {
  label?: string;
  className?: string;
}

/**
 * Shimmer Table Skeleton Loader
 * Mimics a multi-column data grid or ledger table layout
 */
export const TableSkeletonLoader: React.FC<SkeletonProps> = ({
  label = 'Đang tải bảng dữ liệu...',
  className = '',
}) => {
  return (
    <div
      className={`p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden ${className}`}
      role="status"
      aria-label={label}
    >
      {/* Table Header Bar Skeleton */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 animate-shimmer" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 sm:w-48 bg-slate-200 dark:bg-slate-800 rounded-md animate-shimmer" />
            <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/60 rounded-md animate-shimmer" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 sm:w-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-shimmer" />
          <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-shimmer" />
        </div>
      </div>

      {/* Table Rows Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 animate-shimmer shrink-0" />
              <div className="space-y-1.5 min-w-0 flex-1">
                <div
                  className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer"
                  style={{ width: `${60 + (idx % 3) * 15}%` }}
                />
                <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-shimmer" />
              </div>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer ml-auto" />
              <div className="h-2.5 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-shimmer ml-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Subtle Bottom Progress Hint */}
      <div className="flex items-center justify-center gap-2 pt-4 mt-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
        <span>{label}</span>
      </div>
    </div>
  );
};

/**
 * Shimmer Chart Skeleton Loader
 * Mimics donut and bar chart analytics cards
 */
export const ChartSkeletonLoader: React.FC<SkeletonProps> = ({
  label = 'Đang tải biểu đồ phân tích...',
  className = '',
}) => {
  return (
    <div
      className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden ${className}`}
      role="status"
      aria-label={label}
    >
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" />
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
        </div>
        <div className="h-6 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg animate-shimmer" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Donut Circle Outline Skeleton */}
        <div className="md:col-span-5 flex justify-center items-center py-4">
          <div className="w-40 h-40 rounded-full border-8 border-slate-100 dark:border-slate-800/80 animate-shimmer flex items-center justify-center relative">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-900 border-4 border-slate-100 dark:border-slate-800" />
          </div>
        </div>

        {/* Legend / Bar Items Skeleton */}
        <div className="md:col-span-7 space-y-3">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer" />
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer" />
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-200 dark:bg-slate-700 rounded-full animate-shimmer"
                  style={{ width: `${80 - idx * 16}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pt-4 mt-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
        <span>{label}</span>
      </div>
    </div>
  );
};

/**
 * Shimmer Reconcile Skeleton Loader
 * Mimics ReconcileCheckTienView layout (wallet cards + audit list)
 */
export const ReconcileSkeletonLoader: React.FC<SkeletonProps> = ({
  label = 'Đang nạp màn hình đối soát ví & thẻ...',
  className = '',
}) => {
  return (
    <div
      className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden space-y-5 ${className}`}
      role="status"
      aria-label={label}
    >
      {/* Top Banner Skeleton */}
      <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-shimmer flex items-center px-4 justify-between">
        <div className="h-4 w-44 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* 4 Wallet Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 animate-shimmer" />
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer" />
              <div className="h-5 w-28 bg-slate-300 dark:bg-slate-600 rounded animate-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Reconciliation Table Preview Skeleton */}
      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2.5">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer mb-3" />
        {[1, 2, 3].map((j) => (
          <div key={j} className="h-9 bg-slate-100 dark:bg-slate-800/50 rounded-lg animate-shimmer" />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
        <span>{label}</span>
      </div>
    </div>
  );
};

/**
 * Shimmer Sheet Sync Panel Skeleton Loader
 */
export const SheetSyncSkeletonLoader: React.FC<SkeletonProps> = ({
  label = 'Đang nạp bảng đồng bộ Google Sheet...',
  className = '',
}) => {
  return (
    <div
      className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden space-y-4 ${className}`}
      role="status"
      aria-label={label}
    >
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 animate-shimmer" />
        <div className="space-y-1.5">
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
          <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded animate-shimmer" />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
        <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer" />
        <div className="h-9 w-full bg-slate-200 dark:bg-slate-700 rounded-xl animate-shimmer" />
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        <span>{label}</span>
      </div>
    </div>
  );
};
