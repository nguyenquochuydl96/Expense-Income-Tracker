import React, { useEffect, useRef, useState } from 'react';
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
import { motion, AnimatePresence } from 'motion/react';

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
  const [mobileTab, setMobileTab] = useState<'cover' | 'insights'>('cover');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const targetMonth = selectedMonth !== 'ALL' && selectedMonth.includes('-')
    ? selectedMonth
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [yearStr, monthStr] = targetMonth.split('-');
  const monthNum = parseInt(monthStr, 10);
  const yearNum = parseInt(yearStr, 10);

  // Helper to detect Savings / Investment categories or records
  const isSavingsCategory = (catName: string) => {
    const clean = (catName || '').trim().toLowerCase();
    return (
      clean === 'tiết kiệm' ||
      clean.startsWith('tiết kiệm') ||
      clean.includes('tích lũy') ||
      clean.includes('đầu tư')
    );
  };

  const isSavingsRecord = (r: { category?: string; purchaseItem?: string }) => {
    if (isSavingsCategory(r.category || '')) return true;
    const cleanItem = (r.purchaseItem || '').toLowerCase();
    return (
      cleanItem.includes('tiết kiệm') ||
      cleanItem.includes('chỉ vàng') ||
      cleanItem.includes('cây vàng') ||
      cleanItem.includes('gửi tk')
    );
  };

  // Compute month stats
  const monthRecords = allRecords.filter((r) => r.monthKey === targetMonth);
  const incomeRecords = monthRecords.filter((r) => r.sheetType === 'Income');
  const expenseRecords = monthRecords.filter((r) => r.sheetType === 'Expenses');

  const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);

  // Separate Savings from Living Expenses
  const savingsRecords = expenseRecords.filter((r) => isSavingsRecord(r));
  const livingExpenseRecords = expenseRecords.filter((r) => !isSavingsRecord(r));

  const savingsAmount = savingsRecords.reduce((sum, r) => sum + r.amount, 0);
  const livingExpense = livingExpenseRecords.reduce((sum, r) => sum + r.amount, 0);

  // Remaining cash & living budget balances
  const cashRemaining = totalIncome - totalExpense;
  const livingRemaining = totalIncome - livingExpense;

  const savingsPctOfIncome = totalIncome > 0 ? (savingsAmount / totalIncome) * 100 : 0;
  const livingPctOfIncome = totalIncome > 0 ? (livingExpense / totalIncome) * 100 : 0;
  const cashSavingsRate = totalIncome > 0 ? (cashRemaining / totalIncome) * 100 : 0;

  // Top Living Categories (excluding Savings)
  const livingCatMap = new Map<string, number>();
  for (const r of livingExpenseRecords) {
    livingCatMap.set(r.category, (livingCatMap.get(r.category) || 0) + r.amount);
  }
  const topLivingCategories = Array.from(livingCatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      pctOfLiving: livingExpense > 0 ? (amt / livingExpense) * 100 : 0,
      pctOfTotal: totalExpense > 0 ? (amt / totalExpense) * 100 : 0,
    }));

  // Top biggest single living expense item (Loại trừ hoàn toàn các khoản Tiết kiệm / Tích lũy / Đầu tư)
  const sortedLivingExpenses = [...livingExpenseRecords].sort((a, b) => b.amount - a.amount);
  const biggestExpense = sortedLivingExpenses[0] || null;

  // Credit & BE totals
  const totalCredit = expenseRecords.reduce((sum, r) => sum + r.credit, 0);
  const totalBeCorp = expenseRecords.reduce((sum, r) => sum + r.beCorp, 0);

  // Previous month calculation
  const prevDate = new Date(yearNum, monthNum - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const [py, pm] = prevMonthKey.split('-');
  const prevMonthLabel = `T${parseInt(pm, 10)}/${py.slice(2)}`;

  // Compute previous month stats for MoM comparison
  const prevMonthStats = (() => {
    const pRecords = allRecords.filter((r) => r.monthKey === prevMonthKey);
    if (pRecords.length === 0) return null;

    const pIncome = pRecords.filter((r) => r.sheetType === 'Income').reduce((s, r) => s + r.amount, 0);
    const pExpenses = pRecords.filter((r) => r.sheetType === 'Expenses').reduce((s, r) => s + r.amount, 0);

    const pSavings = pRecords
      .filter((r) => r.sheetType === 'Expenses' && isSavingsRecord(r))
      .reduce((s, r) => s + r.amount, 0);
    const pLiving = pExpenses - pSavings;

    const expenseDelta = totalExpense - pExpenses;
    const expenseDeltaPct = pExpenses > 0 ? (expenseDelta / pExpenses) * 100 : 0;

    const livingDelta = livingExpense - pLiving;
    const livingDeltaPct = pLiving > 0 ? (livingDelta / pLiving) * 100 : 0;

    const incomeDelta = totalIncome - pIncome;
    const incomeDeltaPct = pIncome > 0 ? (incomeDelta / pIncome) * 100 : 0;

    // Category shifts: which categories increased or decreased the most (excluding rent and savings)
    const pCatMap = new Map<string, number>();
    for (const r of pRecords.filter((r) => r.sheetType === 'Expenses')) {
      pCatMap.set(r.category, (pCatMap.get(r.category) || 0) + r.amount);
    }

    const allCatMap = new Map<string, number>();
    for (const r of expenseRecords) {
      allCatMap.set(r.category, (allCatMap.get(r.category) || 0) + r.amount);
    }

    const allCatNames = new Set([...allCatMap.keys(), ...pCatMap.keys()]);
    const catShifts: {
      category: string;
      currentAmt: number;
      prevAmt: number;
      delta: number;
      deltaPct: number;
    }[] = [];

    for (const cat of allCatNames) {
      if (isSavingsRecord({ category: cat }) || cat === 'Thuê nhà') continue;
      const cur = allCatMap.get(cat) || 0;
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
      pSavings,
      pLiving,
      expenseDelta,
      expenseDeltaPct,
      livingDelta,
      livingDeltaPct,
      incomeDelta,
      incomeDeltaPct,
      topIncrease,
      topDecrease,
    };
  })();

  // 5% Rule Constants for Traffic Light Evaluation (Đỏ - Vàng - Xanh)
  const MOM_THRESHOLD = 5.0; // 5%

  // Expense MoM status:
  // deltaPct < -5%  => Green (Tiết kiệm hơn)
  // deltaPct > +5%  => Red (Chi nhiều hơn)
  // [-5%, +5%]      => Yellow (Chi tiêu ổn định)
  const isExpenseDecreased = prevMonthStats ? prevMonthStats.expenseDeltaPct < -MOM_THRESHOLD : false;
  const isExpenseIncreased = prevMonthStats ? prevMonthStats.expenseDeltaPct > MOM_THRESHOLD : false;

  // Income MoM status:
  // deltaPct > +5%  => Green (Thu nhập tăng)
  // deltaPct < -5%  => Red (Thu nhập giảm)
  // [-5%, +5%]      => Yellow (Thu nhập ổn định)
  const isIncomeIncreased = prevMonthStats ? prevMonthStats.incomeDeltaPct > MOM_THRESHOLD : false;
  const isIncomeDecreased = prevMonthStats ? prevMonthStats.incomeDeltaPct < -MOM_THRESHOLD : false;

  // Health assessment (Separating Savings from Living Deficit)
  let healthTitle = '';
  let healthDesc = '';
  let healthBadge = '';
  let healthBadgeText = '';
  let healthStars = '';

  if (savingsAmount > 0) {
    if (livingRemaining >= 0) {
      if (cashRemaining >= 0) {
        if (savingsPctOfIncome >= 30) {
          healthStars = '⭐⭐⭐';
          healthTitle = 'Xuất sắc — Tích lũy thần tốc';
          healthDesc = `Bạn đã trích gửi tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), chi tiêu sinh hoạt ${formatCurrency(livingExpense)} rất hợp lý. Dư tiền mặt ${formatCurrency(cashRemaining)}!`;
          healthBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
          healthBadgeText = `Tích lũy: ${savingsPctOfIncome.toFixed(1)}%`;
        } else if (savingsPctOfIncome >= 15) {
          healthStars = '⭐⭐';
          healthTitle = 'Tốt & Cân bằng tài chính';
          healthDesc = `Đã trích tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), chi tiêu sinh hoạt ${formatCurrency(livingExpense)} trong tầm kiểm soát. Dư tiền mặt ${formatCurrency(cashRemaining)}.`;
          healthBadge = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
          healthBadgeText = `Tích lũy: ${savingsPctOfIncome.toFixed(1)}%`;
        } else {
          healthStars = '⭐';
          healthTitle = 'Tích lũy ổn định';
          healthDesc = `Đã trích tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), sinh hoạt trong ngân sách và vẫn dư ${formatCurrency(cashRemaining)} tiền mặt.`;
          healthBadge = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
          healthBadgeText = `Tích lũy: ${savingsPctOfIncome.toFixed(1)}%`;
        }
      } else {
        // livingRemaining >= 0 but cashRemaining < 0 because savings transfer was aggressive
        healthStars = '💎';
        healthTitle = 'Tích lũy vượt mức — Dòng tiền mặt âm nhẹ';
        healthDesc = `Chi sinh hoạt thực tế chỉ ${formatCurrency(livingExpense)} (thặng dư +${formatCurrency(livingRemaining)}). Dòng tiền ví âm ${formatCurrency(Math.abs(cashRemaining))} là do chủ động trích gửi Tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), tài sản tích lũy tăng trưởng rất tốt!`;
        healthBadge = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        healthBadgeText = `Đã trích tiết kiệm: ${savingsPctOfIncome.toFixed(1)}%`;
      }
    } else {
      // livingRemaining < 0
      healthStars = '⚠️';
      healthTitle = 'Chi tiêu sinh hoạt vượt thu nhập';
      healthDesc = `Chi tiêu sinh hoạt (${formatCurrency(livingExpense)}) đã vượt thu nhập ${formatCurrency(Math.abs(livingRemaining))} (chưa tính khoản tiết kiệm ${formatCurrency(savingsAmount)}). Cần rà soát cắt giảm chi tiêu tháng tới!`;
      healthBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      healthBadgeText = `Thâm hụt sinh hoạt: ${((Math.abs(livingRemaining) / totalIncome) * 100).toFixed(1)}%`;
    }
  } else {
    // No savings recorded
    if (cashRemaining >= 0) {
      if (cashSavingsRate >= 30) {
        healthStars = '⭐⭐⭐';
        healthTitle = 'Xuất sắc — Thặng dư cao';
        healthDesc = `Dư ${formatCurrency(cashRemaining)} (${cashSavingsRate.toFixed(1)}% thu nhập). Nên trích một phần vào quỹ tiết kiệm hoặc đầu tư!`;
        healthBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        healthBadgeText = `Thặng dư: +${cashSavingsRate.toFixed(1)}%`;
      } else if (cashSavingsRate >= 15) {
        healthStars = '⭐⭐';
        healthTitle = 'Tốt & Cân bằng tài chính';
        healthDesc = `Dòng tiền dương khỏe mạnh (+${cashSavingsRate.toFixed(1)}%), chi tiêu sinh hoạt điều độ và kiểm soát tốt.`;
        healthBadge = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
        healthBadgeText = `Dư tiền: +${cashSavingsRate.toFixed(1)}%`;
      } else {
        healthStars = '⭐';
        healthTitle = 'Hòa vốn — Cần tích lũy thêm';
        healthDesc = 'Thu vừa đủ bù chi. Nên rà soát bớt các khoản ăn uống/mua sắm để có quỹ dự phòng an toàn.';
        healthBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        healthBadgeText = `Dư tiền: +${cashSavingsRate.toFixed(1)}%`;
      }
    } else {
      healthStars = '⚠️';
      healthTitle = 'Thâm hụt ngân sách';
      healthDesc = `Chi tiêu vượt thu nhập ${formatCurrency(Math.abs(cashRemaining))}. Cần hãm phanh chi tiêu tháng tới!`;
      healthBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      healthBadgeText = `Thâm hụt: -${((Math.abs(cashRemaining) / totalIncome) * 100).toFixed(1)}%`;
    }
  }

  // Copy Summary text for Telegram / Zalo
  const handleCopySummary = () => {
    const lines = [
      `📊 BÁO CÁO TÀI CHÍNH THÁNG ${monthNum}/${yearNum} — HEO & MÈO 🐷🐱`,
      `👨‍👩‍👧‍👦 Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt`,
      `---------------------------------`,
      `💰 Tổng thu nhập: ${formatCurrency(totalIncome)}`,
      `🛒 Chi sinh hoạt: ${formatCurrency(livingExpense)} (${livingPctOfIncome.toFixed(1)}% thu nhập)`,
      savingsAmount > 0 ? `🏦 Trích gửi tiết kiệm: ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập)` : '',
      `💳 Tổng chi thực tế: ${formatCurrency(totalExpense)}`,
      `💵 Dòng tiền mặt còn lại: ${formatCurrency(cashRemaining, cashRemaining > 0)}`,
      `⭐ Đánh giá: ${healthStars} ${healthTitle}`,
      `💡 Chi tiết: ${healthDesc}`,
      prevMonthStats && prevMonthStats.hasData ? [
        `---------------------------------`,
        `📈 So với tháng trước (${prevMonthLabel}):`,
        `  • Tổng chi: ${prevMonthStats.expenseDelta <= 0 ? '' : '+'}${formatCurrency(prevMonthStats.expenseDelta)} (${isExpenseDecreased ? 'tiết kiệm' : isExpenseIncreased ? 'tăng' : 'ổn định'} ${prevMonthStats.expenseDeltaPct.toFixed(1)}%)`,
        `  • Tổng thu nhập: ${prevMonthStats.incomeDelta >= 0 ? '+' : ''}${formatCurrency(prevMonthStats.incomeDelta)} (${prevMonthStats.incomeDeltaPct.toFixed(1)}%)`,
        prevMonthStats.topIncrease ? `  • Tăng nhiều nhất: ${prevMonthStats.topIncrease.category} (+${formatCurrency(prevMonthStats.topIncrease.delta)})` : '',
        prevMonthStats.topDecrease ? `  • Cắt giảm tốt nhất: ${prevMonthStats.topDecrease.category} (${formatCurrency(prevMonthStats.topDecrease.delta)})` : '',
      ].filter(Boolean).join('\n') : '',
      `---------------------------------`,
      `🏆 Top Hạng Mục Chi Tiêu Sinh Hoạt:`,
      ...topLivingCategories.map(
        (c, idx) => `  ${idx + 1}. ${c.category}: ${formatCurrency(c.amount)} (${c.pctOfLiving.toFixed(0)}% sinh hoạt)`
      ),
      biggestExpense ? `🌟 Món chi sinh hoạt lớn nhất: ${biggestExpense.purchaseItem} (${formatCurrency(biggestExpense.amount)})` : '',
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
      const height = (prevMonthStats && prevMonthStats.hasData ? 930 : 830) + (savingsAmount > 0 ? 56 : 0);

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
      ctx.roundRect(36, 115, width - 72, 74, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${healthStars}  ${healthTitle}`, 54, 142);

      // Health badge text on the right
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      const badgeW = ctx.measureText(healthBadgeText).width;
      ctx.fillText(healthBadgeText, width - 54 - badgeW, 142);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      // Word wrap for healthDesc
      const words = healthDesc.split(' ');
      let line = '';
      let descY = 164;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > (width - 108) && n > 0) {
          ctx.fillText(line, 54, descY);
          line = words[n] + ' ';
          descY += 16;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 54, descY);

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
      ctx.fillText(formatCurrency(totalIncome), 50, 258);
      ctx.fillStyle = 'rgba(110, 231, 183, 0.7)';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${incomeRecords.length} giao dịch`, 50, 280);

      // Card 2: Chi tiêu
      const card2Bg = livingRemaining >= 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(244, 63, 94, 0.12)';
      const card2Border = livingRemaining >= 0 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(244, 63, 94, 0.3)';
      const card2TitleCol = livingRemaining >= 0 ? '#C7D2FE' : '#FDA4AF';
      ctx.fillStyle = card2Bg;
      ctx.beginPath();
      ctx.roundRect(36 + cardW + 12, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = card2Border;
      ctx.stroke();
      ctx.fillStyle = card2TitleCol;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText('TỔNG CHI TIÊU', 50 + cardW + 12, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(totalExpense), 50 + cardW + 12, 258);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      const c2Sub = savingsAmount > 0 ? `Sinh hoạt: ${formatNumberForSheet(livingExpense)}` : '100% sinh hoạt';
      ctx.fillText(c2Sub, 50 + cardW + 12, 280);

      // Card 3: Còn lại
      const card3Color = cashRemaining >= 0 ? '#38BDF8' : livingRemaining >= 0 && savingsAmount > 0 ? '#FBBF24' : '#FB7185';
      const card3Bg = cashRemaining >= 0 ? 'rgba(14, 165, 233, 0.12)' : livingRemaining >= 0 && savingsAmount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(244, 63, 94, 0.15)';
      const card3Border = cashRemaining >= 0 ? 'rgba(14, 165, 233, 0.3)' : livingRemaining >= 0 && savingsAmount > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.4)';
      ctx.fillStyle = card3Bg;
      ctx.beginPath();
      ctx.roundRect(36 + (cardW + 12) * 2, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = card3Border;
      ctx.stroke();
      ctx.fillStyle = card3Color;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      const c3Label = cashRemaining >= 0 ? 'CÒN LẠI' : livingRemaining >= 0 && savingsAmount > 0 ? 'DÒNG TIỀN VÍ' : 'THÂM HỤT';
      ctx.fillText(c3Label, 50 + (cardW + 12) * 2, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(cashRemaining, cashRemaining > 0), 50 + (cardW + 12) * 2, 258);
      ctx.fillStyle = card3Color;
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      const c3Sub = savingsAmount > 0 ? `Đã gửi TK: ${formatNumberForSheet(savingsAmount)}` : (cashRemaining >= 0 ? 'Thặng dư ví' : 'Bội chi');
      ctx.fillText(c3Sub, 50 + (cardW + 12) * 2, 280);

      // 5. Savings Banner (if any) + Top Living Categories Section
      let curY = 325;

      if (savingsAmount > 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.beginPath();
        ctx.roundRect(36, curY, width - 72, 46, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.stroke();

        ctx.fillStyle = '#6EE7B7';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText('🏦 Đã trích Tiết kiệm / Tích lũy:', 52, curY + 28);

        ctx.fillStyle = '#A7F3D0';
        ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
        const savText = `${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập)`;
        ctx.fillText(savText, width - 52 - ctx.measureText(savText).width, curY + 28);

        curY += 56;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText('🏆 Top Hạng Mục Chi Tiêu Sinh Hoạt', 36, curY + 16);
      curY += 28;

      topLivingCategories.forEach((cat, idx) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(36, curY, width - 72, 44, 10);
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${idx + 1}. ${cat.category}`, 54, curY + 27);

        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        const amtText = `${formatCurrency(cat.amount)}  (${cat.pctOfLiving.toFixed(0)}% sinh hoạt)`;
        ctx.fillText(amtText, width - 54 - ctx.measureText(amtText).width, curY + 27);

        curY += 50;
      });

      // 6. MoM Comparison Card (Canvas)
      if (prevMonthStats && prevMonthStats.hasData) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.beginPath();
        ctx.roundRect(36, curY + 6, width - 72, 88, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.stroke();

        ctx.fillStyle = '#A5B4FC';
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`📈 So Sánh Với Tháng Trước (${prevMonthLabel}):`, 52, curY + 28);

        // MoM badge on canvas
        const momBadgeText = isExpenseDecreased ? 'Tiết kiệm hơn' : isExpenseIncreased ? 'Chi nhiều hơn' : 'Chi tiêu ổn định';
        const momBadgeColor = isExpenseDecreased ? '#34D399' : isExpenseIncreased ? '#FB7185' : '#FBBF24';
        ctx.fillStyle = momBadgeColor;
        ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
        const mbW = ctx.measureText(momBadgeText).width;
        ctx.fillText(momBadgeText, width - 52 - mbW, curY + 28);

        // Expense delta (5% rule)
        const expColor = isExpenseDecreased ? '#34D399' : isExpenseIncreased ? '#FB7185' : '#FBBF24';
        const expSign = prevMonthStats.expenseDelta <= 0 ? '' : '+';
        ctx.fillStyle = expColor;
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(
          `Tổng chi: ${expSign}${formatCurrency(prevMonthStats.expenseDelta)} (${prevMonthStats.expenseDeltaPct > 0 ? '+' : ''}${prevMonthStats.expenseDeltaPct.toFixed(1)}%)`,
          52,
          curY + 50
        );

        // Income delta (5% rule)
        const incColor = isIncomeIncreased ? '#34D399' : isIncomeDecreased ? '#FB7185' : '#FBBF24';
        const incSign = prevMonthStats.incomeDelta >= 0 ? '+' : '';
        ctx.fillStyle = incColor;
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        const incText = `Tổng thu: ${incSign}${formatCurrency(prevMonthStats.incomeDelta)} (${prevMonthStats.incomeDeltaPct > 0 ? '+' : ''}${prevMonthStats.incomeDeltaPct.toFixed(1)}%)`;
        ctx.fillText(incText, 320, curY + 50);

        if (prevMonthStats.topIncrease || prevMonthStats.topDecrease) {
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '11px "Segoe UI", Arial, sans-serif';
          const shiftDetail = [
            prevMonthStats.topIncrease ? `Tăng: ${prevMonthStats.topIncrease.category} (+${formatCurrency(prevMonthStats.topIncrease.delta)})` : '',
            prevMonthStats.topDecrease ? `Giảm: ${prevMonthStats.topDecrease.category} (${formatCurrency(prevMonthStats.topDecrease.delta)})` : '',
          ].filter(Boolean).join('  ·  ');
          ctx.fillText(shiftDetail, 52, curY + 74);
        }

        curY += 104;
      }

      // 7. Highlights Box (Biggest expense + Credit)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(36, curY + 6, width - 72, 85, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText('🌟 Món chi sinh hoạt lớn nhất:', 54, curY + 28);

      if (biggestExpense) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${biggestExpense.purchaseItem} (${biggestExpense.category})`, 54, curY + 48);
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        const amtW = ctx.measureText(formatCurrency(biggestExpense.amount)).width;
        ctx.fillText(formatCurrency(biggestExpense.amount), width - 54 - amtW, curY + 48);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillText('Không có chi tiêu', 54, curY + 48);
      }

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`💳 Quẹt thẻ tín dụng: ${formatCurrency(totalCredit)}  ·  Ví BE Corp: ${formatCurrency(totalBeCorp)}`, 54, curY + 72);

      // 8. Footer
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Được tạo tự động từ ứng dụng Heo & Mèo Finance · Đồng bộ Google Sheets', 36, height - 20);

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="monthly-report-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 cursor-pointer"
          onClick={onClose}
        >
          {/* 3D BOOK CONTAINER WITH PERSPECTIVE */}
          <div
            style={{ perspective: 1600 }}
            className="w-full max-w-5xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              key="monthly-report-book"
              initial={{ opacity: 0, scale: 0.92, y: 24, rotateX: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24, rotateX: 6 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative bg-slate-950 text-white rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden max-h-[92vh] flex flex-col"
            >
              {/* Top Navigation Bar: Close & Mobile Tab Switcher */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-tabular font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                    Sổ tài chính Tháng {monthNum}/{yearNum}
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-400 font-serif italic">
                    — Heo &amp; Mèo Edition
                  </span>
                </div>

                {/* Mobile Tab Pill Switcher (hidden on md and up) */}
                <div className="flex md:hidden items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setMobileTab('cover')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileTab === 'cover'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bìa Sổ
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('insights')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileTab === 'insights'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Đối Soát
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Đóng sổ (Escape)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* BOOK BODY: DUAL SPREAD (LEFT COVER + RIGHT INSIGHTS) */}
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 relative divide-y md:divide-y-0 md:divide-x divide-slate-800">
                {/* ════════ LEFT PAGE (5 cols): LUXE PASSBOOK COVER ════════ */}
                <motion.div
                  initial={{ rotateY: -15, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{ transformOrigin: 'right center' }}
                  className={`md:col-span-5 p-6 sm:p-7 flex flex-col justify-between space-y-6 relative bg-gradient-to-br from-[#0c162d] via-[#101c38] to-[#0a1122] ${
                    mobileTab === 'insights' ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  {/* Subtle Gold Foil Corner Accents */}
                  <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-400/40 pointer-events-none" />
                  <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-400/40 pointer-events-none" />
                  <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-400/40 pointer-events-none" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-400/40 pointer-events-none" />

                  {/* Top Emblem & Title */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center -space-x-2.5 p-1.5 rounded-2xl bg-amber-400/10 border border-amber-400/30 shadow-inner">
                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shadow-xs">
                          <PigIcon className="w-6 h-6" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#FAF4EE] flex items-center justify-center shadow-xs">
                          <SiameseCatIcon className="w-6 h-6" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400/90 font-mono">
                          Financial Passbook
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          Heo &amp; Mèo Finance
                        </h3>
                        <p className="text-xs text-amber-100/70">
                          Sổ chi tiêu ba mẹ Chuối, Đậu, Vịt
                        </p>
                      </div>
                    </div>

                    {/* Official Health Assessment Seal */}
                    <div className="p-4 rounded-2xl bg-white/[0.04] border border-amber-400/20 shadow-xs space-y-1.5 relative overflow-hidden">
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <span className="text-sm">{healthStars}</span>
                          <span>{healthTitle}</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${healthBadge}`}>
                          {healthBadgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                        {healthDesc}
                      </p>
                    </div>
                  </div>

                  {/* 3 Main Pillars of Financial Balance */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-amber-200/80 uppercase tracking-wider font-mono">
                      Cân đối thu chi tháng
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {/* Income Row */}
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-emerald-200">Tổng thu nhập:</span>
                        </div>
                        <span className="font-extrabold font-mono-tabular text-sm text-emerald-300">
                          {formatCurrency(totalIncome)}
                        </span>
                      </div>

                      {/* Living Expense Row */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-400" />
                          <span className="font-semibold text-slate-300">Chi sinh hoạt:</span>
                        </div>
                        <span className="font-extrabold font-mono-tabular text-sm text-white">
                          {formatCurrency(livingExpense)}
                          <span className="text-[10px] font-normal text-slate-400 ml-1">
                            ({livingPctOfIncome.toFixed(0)}%)
                          </span>
                        </span>
                      </div>

                      {/* Savings Row if exists */}
                      {savingsAmount > 0 && (
                        <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-400" />
                            <span className="font-semibold text-teal-200">Trích gửi Tiết kiệm:</span>
                          </div>
                          <span className="font-extrabold font-mono-tabular text-sm text-teal-300">
                            {formatCurrency(savingsAmount)}
                          </span>
                        </div>
                      )}

                      {/* Net Remaining Row */}
                      <div
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          cashRemaining >= 0
                            ? 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                            : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              cashRemaining >= 0 ? 'bg-sky-400' : 'bg-rose-500'
                            }`}
                          />
                          <span className="font-semibold">
                            {cashRemaining >= 0 ? 'Dòng tiền mặt còn lại:' : 'Dòng tiền ví thâm hụt:'}
                          </span>
                        </div>
                        <span className="font-extrabold font-mono-tabular text-sm">
                          {formatCurrency(cashRemaining, cashRemaining > 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stamp & Verification */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-serif italic">Verified with Google Sheets</span>
                    <span className="font-mono text-amber-400/80 font-bold">HM-PASSBOOK #{monthNum}{yearNum}</span>
                  </div>
                </motion.div>

                {/* ════════ RIGHT PAGE (7 cols): FINANCIAL INSIGHTS & AUDIT ════════ */}
                <motion.div
                  initial={{ rotateY: 15, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{ transformOrigin: 'left center' }}
                  className={`md:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-5 bg-slate-900/90 ${
                    mobileTab === 'cover' ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Section 1: MoM Comparison */}
                    {prevMonthStats && prevMonthStats.hasData && (
                      <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-700/40 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                            <span>So với tháng trước ({prevMonthLabel}):</span>
                          </span>
                          <span
                            className={`text-[10px] font-bold font-mono-tabular px-2.5 py-0.5 rounded-full border ${
                              isExpenseDecreased
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                                : isExpenseIncreased
                                ? 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                                : 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                            }`}
                          >
                            {isExpenseDecreased
                              ? '📉 Tiết kiệm hơn'
                              : isExpenseIncreased
                              ? '📈 Chi nhiều hơn'
                              : '⚖️ Chi tiêu ổn định'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                            <div className="text-slate-400 text-[10px]">Tổng chi:</div>
                            <div
                              className={`font-bold font-mono-tabular text-xs mt-0.5 ${
                                isExpenseDecreased
                                  ? 'text-emerald-300'
                                  : isExpenseIncreased
                                  ? 'text-rose-400'
                                  : 'text-amber-300'
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

                          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                            <div className="text-slate-400 text-[10px]">Tổng thu:</div>
                            <div
                              className={`font-bold font-mono-tabular text-xs mt-0.5 ${
                                isIncomeIncreased
                                  ? 'text-emerald-300'
                                  : isIncomeDecreased
                                  ? 'text-rose-400'
                                  : 'text-amber-300'
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

                        {(prevMonthStats.topIncrease || prevMonthStats.topDecrease) && (
                          <div className="space-y-1 text-[11px] text-slate-300 pt-1 border-t border-indigo-900/40">
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

                    {/* Section 2: Top Living Categories with visual progress bars */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          <span>Top Hạng Mục Chi Tiêu Sinh Hoạt:</span>
                        </span>
                        {livingExpense > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono-tabular">
                            Tổng sinh hoạt: {formatCurrency(livingExpense)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {topLivingCategories.map((c, idx) => (
                          <div
                            key={c.category}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200">
                                {idx + 1}. {c.category}
                              </span>
                              <span className="font-bold font-mono-tabular text-rose-300">
                                {formatCurrency(c.amount)}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({c.pctOfLiving.toFixed(0)}%)
                                </span>
                              </span>
                            </div>
                            {/* Thin progress bar */}
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-rose-400 rounded-full"
                                style={{ width: `${Math.min(100, c.pctOfLiving)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Highlights (Biggest item & Card credit) */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs">
                      {biggestExpense && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Món chi lớn nhất:</span>
                          </span>
                          <span className="font-bold text-amber-300 text-right truncate max-w-[260px]">
                            {biggestExpense.purchaseItem}{' '}
                            <span className="font-mono-tabular text-rose-300">
                              ({formatCurrency(biggestExpense.amount)})
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-400 pt-1.5 border-t border-white/5">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Quẹt thẻ tín dụng:</span>
                        </span>
                        <strong className="text-indigo-300 font-mono-tabular">
                          {formatCurrency(totalCredit)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Ví BE Corp:</span>
                        </span>
                        <strong className="text-amber-300 font-mono-tabular">
                          {formatCurrency(totalBeCorp)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
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
                      className="py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 via-teal-600 to-indigo-600 hover:opacity-95 text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 text-amber-200" />
                      <span>{isGeneratingImg ? 'Đang tạo...' : 'Lưu ảnh thiệp (PNG)'}</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
