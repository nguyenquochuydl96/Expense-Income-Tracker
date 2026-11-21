import { describe, test, expect } from './testHarness';
import { TransactionRecord, BudgetTransferRecord, RealWorldAccount } from '../../src/types/finance';
import {
  computeMultiMonthRollover,
  getDedicatedExpenseCategory,
  DEFAULT_CATEGORY_RATIOS,
} from '../../src/utils/budgetUtils';
import {
  getBillingCycleRange,
  filterRecordsByDateRange,
  isBudgetTransferRecord,
} from '../../src/utils/cycleUtils';
import {
  parseSheetNumber,
  formatNumberForSheet,
  formatCurrency,
  parseDateString,
} from '../../src/utils/csvParser';
import {
  evaluateMoneyExpression,
  parseMoneyNumber,
} from '../../src/utils/mathExpression';

// =========================================================================
// Real-World Scenario 1: Full-Month Dual-Income Family Living Simulation
// =========================================================================
describe('Tier 4 - Scenario 1: Full-Month Dual-Income Family Living Simulation', () => {
  test('T4.S1: Complete October 2026 living simulation with emergency and budget transfer', () => {
    const transactions: TransactionRecord[] = [];
    const transfers: BudgetTransferRecord[] = [];

    // Day 1: Dual salaries arrive
    // Yes4All: 30,000,000 VND, BE: 21,000,000 VND -> 51,000,000 VND
    transactions.push({
      id: 'inc-y4a', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'Lương Yes4All T10', amount: 30000000, beCorp: 0, credit: 0, source: 'google_sheet'
    });
    transactions.push({
      id: 'inc-be', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương BE', purchaseItem: 'Lương BE T10', amount: 21000000, beCorp: 0, credit: 0, source: 'google_sheet'
    });

    // Day 2: House rent paid (8,500,000 VND)
    transactions.push({
      id: 'exp-rent', sheetType: 'Expenses', purchaseDate: '10/2/2026', isoDate: '2026-10-02', monthKey: '2026-10',
      category: 'Thuê nhà', purchaseItem: 'Tiền thuê nhà tháng 10', amount: 8500000, beCorp: 0, credit: 0, source: 'google_sheet'
    });

    // Day 3: Scheduled savings allocation (20,000,000 VND)
    transactions.push({
      id: 'exp-save', sheetType: 'Expenses', purchaseDate: '10/3/2026', isoDate: '2026-10-03', monthKey: '2026-10',
      category: 'Tiết kiệm', purchaseItem: 'Chuyển tiền tiết kiệm kỳ hạn', amount: 20000000, beCorp: 0, credit: 0, source: 'google_sheet'
    });

    // Day 5-15: Routine meals and groceries
    transactions.push({ id: 'm1', sheetType: 'Expenses', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Siêu thị WinMart', amount: 1200000, beCorp: 0, credit: 0, source: 'google_sheet' });
    transactions.push({ id: 'm2', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Đi chợ tuần 2', amount: 950000, beCorp: 0, credit: 0, source: 'google_sheet' });
    transactions.push({ id: 'm3', sheetType: 'Expenses', purchaseDate: '10/15/2026', isoDate: '2026-10-15', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Ăn ngoài cuối tuần', amount: 850000, beCorp: 0, credit: 850000, source: 'google_sheet' });

    // Day 18: Pet emergency vet hospital visit
    // Thú cưng budget is 2,000,000 VND. Total medical emergency cost is 3,500,000 VND.
    transactions.push({
      id: 'exp-pet-emergency', sheetType: 'Expenses', purchaseDate: '10/18/2026', isoDate: '2026-10-18', monthKey: '2026-10',
      category: 'Thú cưng', purchaseItem: 'Cấp cứu thú y & xét nghiệm mèo', amount: 3500000, beCorp: 0, credit: 3500000, source: 'google_sheet'
    });

    // Day 19: Budget transfer from "Tiết kiệm" to cover the 1,500,000 VND deficit
    transfers.push({
      id: 'bt-pet-cover',
      date: '10/19/2026',
      isoDate: '2026-10-19',
      monthKey: '2026-10',
      fromCategory: 'Tiết kiệm',
      toCategory: 'Thú cưng',
      amount: 1500000,
      description: 'Bù chi phí thú y khẩn cấp cho Mèo',
      source: 'local_new',
    });

    // Day 20-28: Remaining living expenses
    transactions.push({ id: 'm4', sheetType: 'Expenses', purchaseDate: '10/22/2026', isoDate: '2026-10-22', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Thực phẩm tuần 4', amount: 1100000, beCorp: 0, credit: 0, source: 'google_sheet' });
    transactions.push({ id: 'm5', sheetType: 'Expenses', purchaseDate: '10/28/2026', isoDate: '2026-10-28', monthKey: '2026-10', category: 'Hóa/Mỹ phẩm', purchaseItem: 'Dầu gội & sữa tắm', amount: 450000, beCorp: 0, credit: 0, source: 'google_sheet' });

    const result = computeMultiMonthRollover(transactions, transfers, {}, 'full');
    const oct = result.chain;

    // Verify Thuê nhà: base 8.5M, spent 8.5M, remaining 0
    expect(oct['Thuê nhà']['2026-10'].spent).toBe(8500000);
    expect(oct['Thuê nhà']['2026-10'].remaining).toBe(0);

    // Verify Thú cưng: base 2M + transferIn 1.5M = effectiveBudget 3.5M. Spent 3.5M -> remaining 0! Deficit resolved!
    const pet = oct['Thú cưng']['2026-10'];
    expect(pet.baseBudget).toBe(2000000);
    expect(pet.netTransfer).toBe(1500000);
    expect(pet.effectiveBudget).toBe(3500000);
    expect(pet.spent).toBe(3500000);
    expect(pet.remaining).toBe(0);
    expect(pet.isOver).toBe(false);

    // Verify Ăn uống: base 7M, spent 4.1M (1.2M + 0.95M + 0.85M + 1.1M), remaining 2.9M surplus
    const food = oct['Ăn uống']['2026-10'];
    expect(food.baseBudget).toBe(7000000);
    expect(food.spent).toBe(4100000);
    expect(food.remaining).toBe(2900000);
  });
});

// =========================================================================
// Real-World Scenario 2: Business Travel & BE Corporate Cycle Reimbursement
// =========================================================================
describe('Tier 4 - Scenario 2: Business Travel & BE Corporate Cycle Reimbursement', () => {
  test('T4.S2: Reimbursable corporate expenses with refund across BE billing cycle (26/09 - 25/10)', () => {
    const cycleRange = getBillingCycleRange('2026-10', 26, 25);
    expect(cycleRange.startDate).toBe('2026-09-26');
    expect(cycleRange.endDate).toBe('2026-10-25');

    const transactions: TransactionRecord[] = [
      // September 28: Flight booking
      { id: 'be-1', sheetType: 'Expenses', purchaseDate: '9/28/2026', isoDate: '2026-09-28', monthKey: '2026-09', category: 'Khác', purchaseItem: 'Vé máy bay công tác SG-HN', amount: 3500000, beCorp: 3500000, credit: 0, source: 'google_sheet' },
      // October 5: Hotel booking
      { id: 'be-2', sheetType: 'Expenses', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Khách sạn công tác 3 đêm', amount: 4200000, beCorp: 4200000, credit: 0, source: 'google_sheet' },
      // October 12: Business client dinner
      { id: 'be-3', sheetType: 'Expenses', purchaseDate: '10/12/2026', isoDate: '2026-10-12', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Tiếp khách đối tác', amount: 1800000, beCorp: 1800000, credit: 0, source: 'google_sheet' },
      // October 20: Ticket cancellation fee refund from airline
      { id: 'be-4', sheetType: 'Expenses', purchaseDate: '10/20/2026', isoDate: '2026-10-20', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Hoàn tiền đổi chặng bay', amount: -500000, beCorp: -500000, credit: 0, source: 'google_sheet' },
      // Personal grocery on October 10
      { id: 'per-1', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Mua thức ăn gia đình', amount: 450000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    // Filter by BE cycle
    const inBeCycle = filterRecordsByDateRange(transactions, cycleRange.startDate, cycleRange.endDate);
    expect(inBeCycle.length).toBe(5);

    // Sum of BE Corp reimbursable amounts: 3.5M + 4.2M + 1.8M - 0.5M = 9,000,000 VND
    const totalBeReimbursement = inBeCycle.reduce((s, r) => s + r.beCorp, 0);
    expect(totalBeReimbursement).toBe(9000000);

    // Personal living expenses in October do NOT include the 9M corporate spend
    const livingSet = new Set(['Ăn uống', 'Giải trí Heo', 'Giải trí Mèo', 'Hóa/Mỹ phẩm']);
    const octLiving = transactions
      .filter(r => r.monthKey === '2026-10' && livingSet.has(r.category));

    const totalLiving = octLiving.reduce((s, r) => s + r.amount, 0);
    expect(totalLiving).toBe(450000); // 450,000 VND only!
  });
});

// =========================================================================
// Real-World Scenario 3: Credit Card Statement Cycle & Cashflow Audit
// =========================================================================
describe('Tier 4 - Scenario 3: Credit Card Statement Cycle & Cashflow Audit', () => {
  test('T4.S3: Credit card purchases across statement cutoff (20/09 - 19/10) and payment audit', () => {
    const octCreditCycle = getBillingCycleRange('2026-10', 20, 19);
    expect(octCreditCycle.startDate).toBe('2026-09-20');
    expect(octCreditCycle.endDate).toBe('2026-10-19');

    const transactions: TransactionRecord[] = [
      // September 25: Electronics purchase on credit card
      { id: 'c-1', sheetType: 'Expenses', purchaseDate: '9/25/2026', isoDate: '2026-09-25', monthKey: '2026-09', category: 'Shopping', purchaseItem: 'Bàn phím cơ', amount: 2500000, beCorp: 0, credit: 2500000, source: 'google_sheet' },
      // October 5: Supermarket purchase on credit card
      { id: 'c-2', sheetType: 'Expenses', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Siêu thị Tops Market', amount: 1500000, beCorp: 0, credit: 1500000, source: 'google_sheet' },
      // October 18: Petrol fill-up on credit card
      { id: 'c-3', sheetType: 'Expenses', purchaseDate: '10/18/2026', isoDate: '2026-10-18', monthKey: '2026-10', category: 'Điện thoại/Xăng xe', purchaseItem: 'Đổ xăng ô tô', amount: 800000, beCorp: 0, credit: 800000, source: 'google_sheet' },
      // October 20: Purchase after statement cutoff -> goes to November statement!
      { id: 'c-4', sheetType: 'Expenses', purchaseDate: '10/20/2026', isoDate: '2026-10-20', monthKey: '2026-10', category: 'Shopping', purchaseItem: 'Áo khoác mùa đông', amount: 1200000, beCorp: 0, credit: 1200000, source: 'google_sheet' },
    ];

    const octCycleItems = filterRecordsByDateRange(transactions, octCreditCycle.startDate, octCreditCycle.endDate);
    expect(octCycleItems.length).toBe(3);
    expect(octCycleItems.map(r => r.id)).toEqual(['c-1', 'c-2', 'c-3']);

    // Total statement bill due for October statement = 4,800,000 VND
    const statementBill = octCycleItems.reduce((s, r) => s + r.credit, 0);
    expect(statementBill).toBe(4800000);

    // Bank account reconciliation before and after paying credit card statement
    const bankAccount: RealWorldAccount = {
      id: 'acc-techcom',
      name: 'Techcombank Heo',
      owner: 'Heo',
      type: 'bank',
      balance: 15000000, // 15,000,000 VND
      includedInReconcile: true,
    };

    const postPaymentBalance = bankAccount.balance - statementBill;
    expect(postPaymentBalance).toBe(10200000);
  });
});

// =========================================================================
// Real-World Scenario 4: Bonus Influx & Dedicated Income Travel Project
// =========================================================================
describe('Tier 4 - Scenario 4: Bonus Influx & Dedicated Income Travel Project', () => {
  test('T4.S4: Earmarked holiday bonus dedicated 100% to Du lịch with spending and rollover', () => {
    const transactions: TransactionRecord[] = [];

    // General monthly salary = 51M VND
    transactions.push({
      id: 'inc-salary', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'Lương chính', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    });

    // Dedicated performance bonus earmarked specifically for Du lịch = 15,000,000 VND
    transactions.push({
      id: 'inc-bonus-travel', sheetType: 'Income', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10',
      category: 'Du lịch', purchaseItem: 'Thưởng quý dành cho du lịch Đà Nẵng', amount: 15000000, beCorp: 0, credit: 0, source: 'google_sheet'
    });

    // Trip expenses throughout October
    transactions.push({ id: 't-1', sheetType: 'Expenses', purchaseDate: '10/8/2026', isoDate: '2026-10-08', monthKey: '2026-10', category: 'Du lịch', purchaseItem: 'Vé máy bay Vietjet khứ hồi', amount: 4800000, beCorp: 0, credit: 4800000, source: 'google_sheet' });
    transactions.push({ id: 't-2', sheetType: 'Expenses', purchaseDate: '10/14/2026', isoDate: '2026-10-14', monthKey: '2026-10', category: 'Du lịch', purchaseItem: 'Resort Đà Nẵng 3 ngày 2 đêm', amount: 5600000, beCorp: 0, credit: 5600000, source: 'google_sheet' });
    transactions.push({ id: 't-3', sheetType: 'Expenses', purchaseDate: '10/16/2026', isoDate: '2026-10-16', monthKey: '2026-10', category: 'Du lịch', purchaseItem: 'Hải sản Bé Mặn & cafe', amount: 2000000, beCorp: 0, credit: 0, source: 'google_sheet' });

    // November general salary (51M) to check carryover
    transactions.push({
      id: 'inc-nov', sheetType: 'Income', purchaseDate: '11/1/2026', isoDate: '2026-11-01', monthKey: '2026-11',
      category: 'Lương Yes4All', purchaseItem: 'Lương T11', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    });

    const result = computeMultiMonthRollover(transactions, [], {}, 'full');
    const octTravel = result.chain['Du lịch']['2026-10'];
    const novTravel = result.chain['Du lịch']['2026-11'];

    // Du lịch in October:
    // General share (1.0/51.0 * 51M) = 1,000,000
    // Dedicated income = 15,000,000
    // Total baseBudget = 16,000,000 VND
    expect(octTravel.baseFromGeneral).toBe(1000000);
    expect(octTravel.dedicatedIncome).toBe(15000000);
    expect(octTravel.baseBudget).toBe(16000000);

    // Total spent on trip = 4.8M + 5.6M + 2.0M = 12,400,000 VND
    expect(octTravel.spent).toBe(12400000);

    // Remaining surplus = 16M - 12.4M = 3,600,000 VND
    expect(octTravel.remaining).toBe(3600000);
    expect(octTravel.isOver).toBe(false);

    // In November:
    // Carryover = 3,600,000 VND
    // Base budget = 1,000,000 VND
    // Effective budget = 4,600,000 VND for next travel goals
    expect(novTravel.carryover).toBe(3600000);
    expect(novTravel.baseBudget).toBe(1000000);
    expect(novTravel.effectiveBudget).toBe(4600000);
  });
});

// =========================================================================
// Real-World Scenario 5: Multi-Month Stress Test with Rollover Deficit Recovery
// =========================================================================
describe('Tier 4 - Scenario 5: Multi-Month Stress Test with Rollover Deficit Recovery', () => {
  test('T4.S5: 4-month journey (April-July 2026) surviving wedding shock and achieving full recovery', () => {
    const transactions: TransactionRecord[] = [];
    const transfers: BudgetTransferRecord[] = [];

    // Historical months (April, May, June, July 2026) with 47.5M income each
    const months = ['2026-04', '2026-05', '2026-06', '2026-07'];
    for (const m of months) {
      const [y, mm] = m.split('-');
      transactions.push({
        id: `inc-${m}`, sheetType: 'Income', purchaseDate: `${parseInt(mm, 10)}/1/${y}`, isoDate: `${m}-01`, monthKey: m,
        category: 'Lương Yes4All', purchaseItem: 'Lương', amount: 47500000, beCorp: 0, credit: 0, source: 'google_sheet'
      });
    }

    // Month 1 (April): Normal wedding/gift spending (spent 3,000,000 against 3,500,000 budget) -> surplus +500,000
    transactions.push({ id: 'apr-w1', sheetType: 'Expenses', purchaseDate: '4/15/2026', isoDate: '2026-04-15', monthKey: '2026-04', category: 'Quà tặng/Cưới hỏi', purchaseItem: 'Cưới bạn ĐH', amount: 3000000, beCorp: 0, credit: 0, source: 'google_sheet' });

    // Month 2 (May): Wedding season shock! Spent 9,500,000 VND (3 weddings + tân gia)
    transactions.push({ id: 'may-w1', sheetType: 'Expenses', purchaseDate: '5/02/2026', isoDate: '2026-05-02', monthKey: '2026-05', category: 'Quà tặng/Cưới hỏi', purchaseItem: 'Cưới em gái', amount: 5000000, beCorp: 0, credit: 0, source: 'google_sheet' });
    transactions.push({ id: 'may-w2', sheetType: 'Expenses', purchaseDate: '5/12/2026', isoDate: '2026-05-12', monthKey: '2026-05', category: 'Quà tặng/Cưới hỏi', purchaseItem: 'Cưới đồng nghiệp', amount: 2500000, beCorp: 0, credit: 0, source: 'google_sheet' });
    transactions.push({ id: 'may-w3', sheetType: 'Expenses', purchaseDate: '5/25/2026', isoDate: '2026-05-25', monthKey: '2026-05', category: 'Quà tặng/Cưới hỏi', purchaseItem: 'Mừng tân gia sếp', amount: 2000000, beCorp: 0, credit: 0, source: 'google_sheet' });

    // Month 3 (June): Heavy deficit carried over. Spent only 500,000 VND
    transactions.push({ id: 'jun-w1', sheetType: 'Expenses', purchaseDate: '6/10/2026', isoDate: '2026-06-10', monthKey: '2026-06', category: 'Quà tặng/Cưới hỏi', purchaseItem: 'Sinh nhật bạn thân', amount: 500000, beCorp: 0, credit: 0, source: 'google_sheet' });

    // Month 4 (July): Extra freelancing income arrived in July (10,000,000 VND dedicated to Quà tặng)
    transactions.push({
      id: 'inc-extra-jul', sheetType: 'Income', purchaseDate: '7/10/2026', isoDate: '2026-07-10', monthKey: '2026-07',
      category: 'Quà tặng/Cưới hỏi', purchaseItem: 'Thu nhập thưởng thêm để bù quỹ cưới', amount: 10000000, beCorp: 0, credit: 0, source: 'google_sheet'
    });
    // July spent 1,000,000 VND
    transactions.push({ id: 'jul-w1', sheetType: 'Expenses', purchaseDate: '7/20/2026', isoDate: '2026-07-20', monthKey: '2026-07', category: 'Quà tặng/Cưới hỏi', purchaseItem: 'Quà đầy tháng cháu', amount: 1000000, beCorp: 0, credit: 0, source: 'google_sheet' });

    const result = computeMultiMonthRollover(transactions, transfers, {}, 'full');
    const chain = result.chain['Quà tặng/Cưới hỏi'];

    // April (T4): base = 3,500,000 (3.5/47.5 * 47.5M), spent = 3,000,000 -> remaining = +500,000
    expect(chain['2026-04'].baseBudget).toBe(3500000);
    expect(chain['2026-04'].remaining).toBe(500000);

    // May (T5): carryover = +500,000, base = 3,500,000 -> effective = 4,000,000. Spent = 9,500,000
    // Remaining = 4M - 9.5M = -5,500,000 (isOver = true!)
    expect(chain['2026-05'].carryover).toBe(500000);
    expect(chain['2026-05'].effectiveBudget).toBe(4000000);
    expect(chain['2026-05'].spent).toBe(9500000);
    expect(chain['2026-05'].remaining).toBe(-5500000);
    expect(chain['2026-05'].isOver).toBe(true);

    // June (T6): carryover = -5,500,000, base = 3,500,000 -> effective = -2,000,000
    // Spent = 500,000 -> remaining = -2,500,000 (deficit amortizing)
    expect(chain['2026-06'].carryover).toBe(-5500000);
    expect(chain['2026-06'].effectiveBudget).toBe(-2000000);
    expect(chain['2026-06'].spent).toBe(500000);
    expect(chain['2026-06'].remaining).toBe(-2500000);
    expect(chain['2026-06'].isOver).toBe(true);

    // July (T7): carryover = -2,500,000, base general = 3,500,000 + dedicated = 10,000,000 = base 13,500,000
    // Effective budget = 13.5M - 2.5M = 11,000,000!
    // Spent = 1,000,000 -> Remaining = +10,000,000! Fully recovered and healthy surplus!
    expect(chain['2026-07'].carryover).toBe(-2500000);
    expect(chain['2026-07'].dedicatedIncome).toBe(10000000);
    expect(chain['2026-07'].effectiveBudget).toBe(11000000);
    expect(chain['2026-07'].spent).toBe(1000000);
    expect(chain['2026-07'].remaining).toBe(10000000);
    expect(chain['2026-07'].isOver).toBe(false);
  });
});
