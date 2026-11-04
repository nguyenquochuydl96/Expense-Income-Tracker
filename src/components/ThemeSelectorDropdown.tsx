import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Check, Sparkles, ChevronDown } from 'lucide-react';
import { useThemeSystem, ThemePalette } from '../utils/themeService';

export interface ThemeSelectorDropdownProps {
  compact?: boolean;
}

export const ThemeSelectorDropdown: React.FC<ThemeSelectorDropdownProps> = ({ compact = false }) => {
  const { palette, setPalette, activeThemeConfig, availablePalettes } = useThemeSystem();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectPalette = (id: ThemePalette) => {
    setPalette(id);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer shadow-xs"
        title={`Giao diện: ${activeThemeConfig.name} (Nhấp để đổi)`}
        aria-label="Chọn giao diện & màu sắc"
      >
        <Palette className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
        <span className="text-sm leading-none">{activeThemeConfig.icon}</span>
        {!compact && (
          <span className="hidden md:inline font-medium text-slate-100 max-w-[110px] truncate">
            {activeThemeConfig.name.split('&')[0].trim()}
          </span>
        )}
        <div
          className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0 shadow-2xs"
          style={{ backgroundColor: activeThemeConfig.accentColor }}
        />
        <ChevronDown
          className={`w-3 h-3 text-white/70 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ type: 'spring', damping: 25, stiffness: 360 }}
            className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-2xl border border-white/15 bg-slate-900/95 text-slate-100 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/10 mb-1.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Bộ Chọn Giao Diện (Theme)</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tự động ghi nhớ cho các lần mở app sau
                </p>
              </div>
            </div>

            {/* List of 5 Palettes */}
            <div className="space-y-1">
              {availablePalettes.map((item) => {
                const isSelected = item.id === palette;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPalette(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-white/15 border border-white/20 text-white shadow-inner'
                        : 'hover:bg-white/5 border border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-xl leading-none shrink-0 group-hover:scale-110 transition-transform">
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate text-white">
                            {item.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {item.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Color Swatches & Check */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center -space-x-1">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                          style={{ backgroundColor: item.accentColor }}
                        />
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                          style={{ backgroundColor: item.secondaryColor }}
                        />
                      </div>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-slate-500 text-[10px]">
                          ➔
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
