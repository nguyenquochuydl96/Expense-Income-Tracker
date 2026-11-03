import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  Award,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react';
import { TransactionRecord } from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { PigIcon, SiameseCatIcon } from '../utils/categoryIcons';

interface MonthlyReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  allRecords: TransactionRecord[];
}

export const MonthlyReportCardModal: React.FC<MonthlyReportCardModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  allRecords,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const targetMonth = selectedMonth !== 'ALL' && selectedMonth.includes('-')
    ? selectedMonth
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [yearStr, monthStr] = targetMonth.split('-');
  const monthNum = parseInt(monthStr, 10);
  const yearNum = parseInt(yearStr, 10);

  // Compute month stats
  const monthRecords = allRecords.filter((r) => r.monthKey === targetMonth);
  const incomeRecords = monthRecords.filter((r) => r.sheetType === 'Income');
  const expenseRecords = monthRecords.filter((r) => r.sheetType === 'Expenses');

  const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
  const remaining = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (remaining / totalIncome) * 100 : 0;

  // Top 3 categories
  const catMap = new Map<string, number>();
  for (const r of expenseRecords) {
    catMap.set(r.category, (catMap.get(r.category) || 0) + r.amount);
  }
  const topCategories = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      pct: totalExpense > 0 ? (amt / totalExpense) * 100 : 0,
    }));

  // Top biggest single expense item
  const sortedExpenses = [...expenseRecords].sort((a, b) => b.amount - a.amount);
  const biggestExpense = sortedExpenses[0] || null;

  // Credit & BE totals
  const totalCredit = expenseRecords.reduce((sum, r) => sum + r.credit, 0);
  const totalBeCorp = expenseRecords.reduce((sum, r) => sum + r.beCorp, 0);

  // Previous month calculation
  const prevMonthKey = useMemo(() => {
    const d = new Date(yearNum, monthNum - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [yearNum, monthNum]);

  const prevMonthLabel = useMemo(() => {
    const [py, pm] = prevMonthKey.split('-');
    return `T${parseInt(pm, 10)}/${py.slice(2)}`;
  }, [prevMonthKey]);

  // Compute previous month stats for MoM comparison
  const prevMonthStats = useMemo(() => {
    const pRecords = allRecords.filter((r) => r.monthKey === prevMonthKey);
    if (pRecords.length === 0) return null;

    const pIncome = pRecords.filter((r) => r.sheetType === 'Income').reduce((s, r) => s + r.amount, 0);
    const pExpenses = pRecords.filter((r) => r.sheetType === 'Expenses').reduce((s, r) => s + r.amount, 0);

    const expenseDelta = totalExpense - pExpenses;
    const expenseDeltaPct = pExpenses > 0 ? (expenseDelta / pExpenses) * 100 : 0;

    const incomeDelta = totalIncome - pIncome;
    const incomeDeltaPct = pIncome > 0 ? (incomeDelta / pIncome) * 100 : 0;

    // Category shifts: which categories increased or decreased the most
    const pCatMap = new Map<string, number>();
    for (const r of pRecords.filter((r) => r.sheetType === 'Expenses')) {
      pCatMap.set(r.category, (pCatMap.get(r.category) || 0) + r.amount);
    }

    const allCatNames = new Set([...catMap.keys(), ...pCatMap.keys()]);
    const catShifts: {
      category: string;
      currentAmt: number;
      prevAmt: number;
      delta: number;
      deltaPct: number;
    }[] = [];

    for (const cat of allCatNames) {
      if (cat === 'Tiết kiệm' || cat === 'Thuê nhà') continue;
      const cur = catMap.get(cat) || 0;
      const prev = pCatMap.get(cat) || 0;
      const delta = cur - prev;
      const deltaPct = prev > 0 ? (delta / prev) * 100 : cur > 0 ? 100 : 0;
      catShifts.push({ category: cat, currentAmt: cur, prevAmt: prev, delta, deltaPct });
    }

    // Top increase & Top decrease
    const topIncrease = catShifts.filter((c) => c.delta > 50000).sort((a, b) => b.delta - a.delta)[0] || null;
    const topDecrease = catShifts.filter((c) => c.delta < -50000).sort((a, b) => a.delta - b.delta)[0] || null;

    return {
      hasData: true,
      pIncome,
      pExpenses,
      expenseDelta,
      expenseDeltaPct,
      incomeDelta,
      incomeDeltaPct,
      topIncrease,
      topDecrease,
    };
  }, [allRecords, prevMonthKey, totalExpense, totalIncome, catMap]);

  // Health assessment
  let healthTitle = '';
  let healthDesc = '';
  let healthBadge = '';
  let healthStars = '';

  if (savingsRate >= 30) {
    healthStars = '⭐⭐⭐';
    healthTitle = 'Xuất sắc — Tích lũy thần tốc';
    healthDesc = `Bạn đã tiết kiệm được ${savingsRate.toFixed(1)}% thu nhập tháng này, vượt xa tiêu chuẩn vàng 20%!`;
    healthBadge = 'bg-emerald-100 text-emerald-900 border-emerald-300';
  } else if (savingsRate >= 15) {
    healthStars = '⭐⭐';
    healthTitle = 'Tốt & Cân bằng tài chính';
    healthDesc = `Dòng tiền dương khỏe mạnh (+${savingsRate.toFixed(1)}%), chi tiêu điều độ và kiểm soát tốt.`;
    healthBadge = 'bg-teal-100 text-teal-900 border-teal-300';
  } else if (savingsRate >= 0) {
    healthStars = '⭐';
    healthTitle = 'Hòa vốn — Cần tích lũy thêm';
    healthDesc = 'Thu vừa đủ bù chi. Nên rà soát bớt các khoản ăn uống/mua sắm để có quỹ dự phòng an toàn.';
    healthBadge = 'bg-amber-100 text-amber-900 border-amber-300';
  } else {
    healthStars = '⚠️';
    healthTitle = 'Thâm hụt ngân sách';
    healthDesc = `Chi tiêu vượt thu nhập ${formatCurrency(Math.abs(remaining))}. Cần hãm phanh chi tiêu tháng tới!`;
    healthBadge = 'bg-rose-100 text-rose-900 border-rose-300';
  }

  // Copy Summary text for Telegram / Zalo
  const handleCopySummary = () => {
    const lines = [
      `📊 BÁO CÁO TÀI CHÍNH THÁNG ${monthNum}/${yearNum} — HEO & MÈO 🐷🐱`,
      `👨‍👩‍👧‍👦 Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt`,
      `---------------------------------`,
      `💰 Tổng thu nhập: ${formatCurrency(totalIncome)}`,
      `🛒 Tổng chi tiêu: ${formatCurrency(totalExpense)}`,
      `🏦 Số dư còn lại: ${formatCurrency(remaining, remaining > 0)} (${savingsRate.toFixed(1)}%)`,
      `⭐ Đánh giá: ${healthStars} ${healthTitle}`,
      prevMonthStats && prevMonthStats.hasData ? [
        `---------------------------------`,
        `📈 So với tháng trước (${prevMonthLabel}):`,
        `  • Tổng chi: ${prevMonthStats.expenseDelta <= 0 ? '' : '+'}${formatCurrency(prevMonthStats.expenseDelta)} (${prevMonthStats.expenseDelta <= 0 ? 'tiết kiệm' : 'tăng'} ${Math.abs(prevMonthStats.expenseDeltaPct).toFixed(1)}%)`,
        prevMonthStats.topIncrease ? `  • Tăng nhiều nhất: ${prevMonthStats.topIncrease.category} (+${formatCurrency(prevMonthStats.topIncrease.delta)})` : '',
        prevMonthStats.topDecrease ? `  • Cắt giảm tốt nhất: ${prevMonthStats.topDecrease.category} (${formatCurrency(prevMonthStats.topDecrease.delta)})` : '',
      ].filter(Boolean).join('\n') : '',
      `---------------------------------`,
      `🏆 Top 3 Hạng mục chi nhiều nhất:`,
      ...topCategories.map(
        (c, idx) => `  ${idx + 1}. ${c.category}: ${formatCurrency(c.amount)} (${c.pct.toFixed(0)}%)`
      ),
      biggestExpense ? `🌟 Món chi lớn nhất: ${biggestExpense.purchaseItem} (${formatCurrency(biggestExpense.amount)})` : '',
      totalCredit > 0 ? `💳 Quẹt thẻ tín dụng: ${formatCurrency(totalCredit)}` : '',
      `---------------------------------`,
      `🔗 Xem chi tiết tại https://nguyenquochuydl96.github.io/Expense-Income-Tracker/`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download High-Resolution Infographic Card as PNG via Canvas
  const handleDownloadImage = () => {
    setIsGeneratingImg(true);

    try {
      const canvas = document.createElement('canvas');
      const scale = 2; // High DPI for crisp rendering
      const width = 600;
      const height = prevMonthStats && prevMonthStats.hasData ? 920 : 820;

      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // 1. Background gradient (Dark Navy fintech theme)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#132247');
      bgGrad.addColorStop(0.35, '#0E1726');
      bgGrad.addColorStop(1, '#0B0F19');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Background decorative glowing circles
      ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.beginPath();
      ctx.arc(width - 50, 100, 160, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(20, 184, 166, 0.08)';
      ctx.beginPath();
      ctx.arc(50, height - 100, 140, 0, Math.PI * 2);
      ctx.fill();

      // 2. Header Brand
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Heo & Mèo Finance', 36, 55);

      ctx.fillStyle = '#93C5FD';
      ctx.font = '500 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt', 36, 76);

      // Period Pill badge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(width - 170, 38, 134, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`THÁNG ${monthNum}/${yearNum}`, width - 150, 58);

      // Decorative separator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36, 96);
      ctx.lineTo(width - 36, 96);
      ctx.stroke();

      // 3. Health Assessment Banner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(36, 115, width - 72, 72, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${healthStars}  ${healthTitle}`, 54, 145);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      ctx.fillText(healthDesc, 54, 168);

      // 4. Three Big KPI Cards
      const cardW = (width - 72 - 24) / 3;

      // Card 1: Thu nhập
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.beginPath();
      ctx.roundRect(36, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.stroke();
      ctx.fillStyle = '#6EE7B7';
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText('TỔNG THU NHẬP', 50, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(totalIncome), 50, 260);

      // Card 2: Chi tiêu
      ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
      ctx.beginPath();
      ctx.roundRect(36 + cardW + 12, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
      ctx.stroke();
      ctx.fillStyle = '#FDA4AF';
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText('TỔNG CHI TIÊU', 50 + cardW + 12, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(totalExpense), 50 + cardW + 12, 260);

      // Card 3: Còn lại
      const remColor = remaining >= 0 ? '#38BDF8' : '#FB7185';
      ctx.fillStyle = remaining >= 0 ? 'rgba(14, 165, 233, 0.12)' : 'rgba(244, 63, 94, 0.15)';
      ctx.beginPath();
      ctx.roundRect(36 + (cardW + 12) * 2, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = remaining >= 0 ? 'rgba(14, 165, 233, 0.3)' : 'rgba(244, 63, 94, 0.4)';
      ctx.stroke();
      ctx.fillStyle = remColor;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText('CÒN LẠI / TÍCH LŨY', 50 + (cardW + 12) * 2, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(remaining, remaining > 0), 50 + (cardW + 12) * 2, 260);

      // 5. Top Categories Section
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText('🏆 Top Hạng Mục Chi Nhiều Nhất', 36, 335);

      let topY = 360;
      topCategories.forEach((cat, idx) => {
        // Container box
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(36, topY, width - 72, 48, 10);
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${idx + 1}. ${cat.category}`, 54, topY + 28);

        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
        const amtText = `${formatCurrency(cat.amount)}  (${cat.pct.toFixed(0)}%)`;
        ctx.fillText(amtText, width - 54 - ctx.measureText(amtText).width, topY + 28);

        topY += 56;
      });

      // 6. MoM Comparison Card (Canvas)
      if (prevMonthStats && prevMonthStats.hasData) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.beginPath();
        ctx.roundRect(36, topY + 8, width - 72, 85, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.stroke();

        ctx.fillStyle = '#A5B4FC';
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`📈 So Sánh Với Tháng Trước (${prevMonthLabel}):`, 52, topY + 30);

        const expSign = prevMonthStats.expenseDelta <= 0 ? '' : '+';
        const expColor = prevMonthStats.expenseDelta <= 0 ? '#34D399' : '#FB7185';
        ctx.fillStyle = expColor;
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(
          `Tổng chi: ${expSign}${formatCurrency(prevMonthStats.expenseDelta)} (${prevMonthStats.expenseDelta <= 0 ? 'tiết kiệm' : 'tăng'} ${Math.abs(prevMonthStats.expenseDeltaPct).toFixed(1)}%)`,
          52,
          topY + 52
        );

        if (prevMonthStats.topIncrease || prevMonthStats.topDecrease) {
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '11px "Segoe UI", Arial, sans-serif';
          const shiftDetail = [
            prevMonthStats.topIncrease ? `Tăng: ${prevMonthStats.topIncrease.category} (+${formatCurrency(prevMonthStats.topIncrease.delta)})` : '',
            prevMonthStats.topDecrease ? `Giảm: ${prevMonthStats.topDecrease.category} (${formatCurrency(prevMonthStats.topDecrease.delta)})` : '',
          ].filter(Boolean).join('  ·  ');
          ctx.fillText(shiftDetail, 52, topY + 72);
        }

        topY += 98;
      }

      // 7. Highlights Box (Biggest expense + Credit)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(36, topY + 10, width - 72, 120, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText('🌟 Món chi tiêu lớn nhất:', 54, topY + 38);

      if (biggestExpense) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${biggestExpense.purchaseItem} (${biggestExpense.category})`, 54, topY + 60);
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(formatCurrency(biggestExpense.amount), 54, topY + 80);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillText('Không có chi tiêu', 54, topY + 60);
      }

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`💳 Quẹt thẻ tín dụng: ${formatCurrency(totalCredit)}  ·  Ví BE Corp: ${formatCurrency(totalBeCorp)}`, 54, topY + 112);

      // 7. Footer
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Được tạo tự động từ ứng dụng Heo & Mèo Finance · Đồng bộ Google Sheets', 36, height - 24);

      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Bao_Cao_Tai_Chinh_Thang_${monthNum}_${yearNum}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export canvas:', err);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 text-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-700/80 relative space-y-5 max-h-[90vh] overflow-y-auto cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Infographic Card Preview Container */}
        <div ref={cardRef} className="space-y-5">
          {/* Brand & Title */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center -space-x-2.5 p-1 rounded-2xl bg-white/10 border border-white/20">
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center">
                  <PigIcon className="w-5.5 h-5.5" />
                </div>
                <div className="w-9 h-9 rounded-full bg-[#FAF4EE] flex items-center justify-center">
                  <SiameseCatIcon className="w-5.5 h-5.5" />
                </div>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Heo &amp; Mèo Finance
                </h3>
                <p className="text-[11px] text-pink-200/90 font-medium">
                  Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono-tabular">
              Tháng {monthNum}/{yearNum}
            </span>
          </div>

          {/* Health Assessment Banner */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>{healthStars}</span>
                <span>{healthTitle}</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${healthBadge}`}>
                Tỷ lệ tích lũy: {savingsRate.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{healthDesc}</p>
          </div>

          {/* 3 Main KPI Metrics */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 text-center">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                Thu nhập
              </div>
              <div className="text-sm sm:text-base font-extrabold font-mono-tabular text-emerald-200 mt-1 truncate">
                {formatCurrency(totalIncome)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-center">
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wide">
                Chi tiêu
              </div>
              <div className="text-sm sm:text-base font-extrabold font-mono-tabular text-rose-200 mt-1 truncate">
                {formatCurrency(totalExpense)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-800/40 text-center">
              <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">
                Còn lại
              </div>
              <div
                className={`text-sm sm:text-base font-extrabold font-mono-tabular mt-1 truncate ${
                  remaining >= 0 ? 'text-sky-200' : 'text-rose-300'
                }`}
              >
                {formatCurrency(remaining, remaining > 0)}
              </div>
            </div>
          </div>

          {/* Top 3 Categories */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Top Hạng Mục Chi Nhiều Nhất:</span>
            </div>

            <div className="space-y-1.5 text-xs">
              {topCategories.map((c, idx) => (
                <div
                  key={c.category}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-200">
                    {idx + 1}. {c.category}
                  </span>
                  <span className="font-bold font-mono-tabular text-rose-300">
                    {formatCurrency(c.amount)}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({c.pct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* MoM Comparison Card (So sánh với tháng trước) */}
          {prevMonthStats && prevMonthStats.hasData && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>So với tháng trước ({prevMonthLabel}):</span>
                </span>
                <span
                  className={`text-[10px] font-bold font-mono-tabular px-2 py-0.5 rounded-full border ${
                    prevMonthStats.expenseDelta <= 0
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                      : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                  }`}
                >
                  {prevMonthStats.expenseDelta <= 0 ? '📉 Tiết kiệm hơn' : '📈 Chi nhiều hơn'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                {/* Tổng chi biến động */}
                <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-slate-400 text-[10px]">Tổng chi tiêu:</div>
                  <div
                    className={`font-bold font-mono-tabular text-xs mt-0.5 ${
                      prevMonthStats.expenseDelta <= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {prevMonthStats.expenseDelta <= 0 ? '' : '+'}
                    {formatCurrency(prevMonthStats.expenseDelta)}{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      ({prevMonthStats.expenseDeltaPct > 0 ? '+' : ''}
                      {prevMonthStats.expenseDeltaPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Thu nhập biến động */}
                <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-slate-400 text-[10px]">Tổng thu nhập:</div>
                  <div
                    className={`font-bold font-mono-tabular text-xs mt-0.5 ${
                      prevMonthStats.incomeDelta >= 0 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {prevMonthStats.incomeDelta >= 0 ? '+' : ''}
                    {formatCurrency(prevMonthStats.incomeDelta)}{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      ({prevMonthStats.incomeDeltaPct > 0 ? '+' : ''}
                      {prevMonthStats.incomeDeltaPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Danh mục tăng / giảm nhiều nhất */}
              {(prevMonthStats.topIncrease || prevMonthStats.topDecrease) && (
                <div className="space-y-1 text-[11px] text-slate-300 pt-1 border-t border-indigo-900/50">
                  {prevMonthStats.topIncrease && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">• Tăng nhiều nhất:</span>
                      <span className="font-semibold text-rose-300">
                        {prevMonthStats.topIncrease.category} (+{formatCurrency(prevMonthStats.topIncrease.delta)})
                      </span>
                    </div>
                  )}
                  {prevMonthStats.topDecrease && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">• Cắt giảm tốt nhất:</span>
                      <span className="font-semibold text-emerald-300">
                        {prevMonthStats.topDecrease.category} ({formatCurrency(prevMonthStats.topDecrease.delta)})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Highlights Info Box */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5 text-xs">
            {biggestExpense && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Món chi lớn nhất:</span>
                </span>
                <span className="font-bold text-amber-300">
                  {biggestExpense.purchaseItem} ({formatCurrency(biggestExpense.amount)})
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/5">
              <span>Quẹt thẻ tín dụng:</span>
              <strong className="text-indigo-300 font-mono-tabular">
                {formatCurrency(totalCredit)}
              </strong>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Đã chép tóm tắt!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-300" />
                <span>Sao chép tóm tắt</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isGeneratingImg}
            className="py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>{isGeneratingImg ? 'Đang tạo...' : 'Lưu ảnh thiệp (PNG)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
