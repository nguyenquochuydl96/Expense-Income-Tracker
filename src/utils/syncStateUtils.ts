import { BudgetTransferRecord, TransactionRecord } from '../types/finance';

export interface RowSignature {
  purchaseDate: string;
  amount: number;
  purchaseItem: string;
}

/**
 * Generate a collision-resistant unique txId (UUID v4 when Web Crypto is available).
 */
export function generateTxId(prefix = 'tx'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a minimal row signature used for safe legacy rowIndex verification on Google Sheets.
 */
export function buildRowSignature(
  rec?: Partial<Pick<TransactionRecord, 'purchaseDate' | 'amount' | 'purchaseItem'>> | null
): RowSignature | undefined {
  if (!rec) return undefined;
  return {
    purchaseDate: (rec.purchaseDate || '').trim(),
    amount: Number(rec.amount) || 0,
    purchaseItem: (rec.purchaseItem || '').trim(),
  };
}

/**
 * Detect whether a sync error indicates a row conflict / missing txId on the remote sheet.
 */
export function isSyncConflictError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { conflict?: boolean; code?: string };
  return (
    anyErr.conflict === true ||
    anyErr.code === 'NOT_FOUND' ||
    anyErr.code === 'SIGNATURE_MISMATCH'
  );
}

function buildTransferFingerprint(t: BudgetTransferRecord): string {
  return `${(t.date || '').trim()}|${(t.fromCategory || '').trim()}|${(t.toCategory || '').trim()}|${Number(t.amount) || 0}|${(t.description || '').trim()}`;
}

/**
 * Merge remote Google Sheet budget transfers with local state without losing unsynced local transfers.
 */
export function mergeBudgetTransfersOnSync(
  prevTransfers: BudgetTransferRecord[],
  liveTransfers: BudgetTransferRecord[],
  pushedIds: ReadonlySet<string> = new Set()
): BudgetTransferRecord[] {
  const safePrev = Array.isArray(prevTransfers) ? prevTransfers : [];
  const safeLive = Array.isArray(liveTransfers) ? liveTransfers : [];

  const liveIdSet = new Set<string>();
  const liveFingerprints = new Set<string>();
  for (const t of safeLive) {
    if (t.id) liveIdSet.add(t.id);
    if (t.txId) liveIdSet.add(t.txId);
    liveFingerprints.add(buildTransferFingerprint(t));
  }

  const unsyncedLocal = safePrev.filter((t) => {
    if (t.source !== 'local_new' || t.syncedToSheet) return false;
    if (pushedIds.has(t.id) || (t.txId && pushedIds.has(t.txId))) return false;
    if (liveIdSet.has(t.id) || (t.txId && liveIdSet.has(t.txId))) return false;
    if (liveFingerprints.has(buildTransferFingerprint(t))) return false;
    return true;
  });

  if (safeLive.length > 0) {
    return [...unsyncedLocal, ...safeLive];
  }

  // If the remote sheet returned no transfers (e.g. tab not yet created), preserve local/seed state
  // while marking any successfully pushed items as synced.
  if (pushedIds.size > 0) {
    return safePrev.map((t) =>
      pushedIds.has(t.id) || (t.txId && pushedIds.has(t.txId))
        ? { ...t, syncedToSheet: true }
        : t
    );
  }

  return safePrev;
}

/**
 * Targeted functional rollback for a failed edit on a nullable record list (sheetRecords).
 * Restores ONLY the target record while preserving any concurrent additions, edits, or syncs.
 */
export function rollbackEditedRecord<T extends { id: string }>(
  prev: T[] | null,
  originalRecord: T | undefined,
  targetId: string
): T[] | null {
  if (!prev || !originalRecord) return prev;
  return prev.map((r) => (r.id === targetId ? originalRecord : r));
}

/**
 * Targeted functional rollback for a failed edit on a non-null record list (localNewRecords / attachedRecords).
 */
export function rollbackEditedListRecord<T extends { id: string }>(
  prev: T[],
  originalRecord: T | undefined,
  targetId: string
): T[] {
  if (!originalRecord) return prev;
  return prev.map((r) => (r.id === targetId ? originalRecord : r));
}

/**
 * Targeted functional rollback for a failed delete on sheetRecords.
 * Reverses the optimistic rowIndex shift on the same sheetType and re-inserts ONLY the deleted record,
 * preserving all other concurrent state mutations.
 */
export function rollbackDeletedRecord(
  prev: TransactionRecord[] | null,
  deletedRecord: TransactionRecord | undefined
): TransactionRecord[] | null {
  if (!prev || !deletedRecord) return prev;
  if (prev.some((r) => r.id === deletedRecord.id)) {
    return prev;
  }

  const restoredIndices =
    deletedRecord.rowIndex !== undefined
      ? prev.map((r) => {
          if (
            r.sheetType === deletedRecord.sheetType &&
            r.rowIndex !== undefined &&
            r.rowIndex >= deletedRecord.rowIndex!
          ) {
            return { ...r, rowIndex: r.rowIndex + 1 };
          }
          return r;
        })
      : prev;

  return [...restoredIndices, deletedRecord];
}

/**
 * Targeted functional rollback for a failed delete on localNewRecords / attachedRecords.
 */
export function rollbackDeletedListRecord<T extends { id: string }>(
  prev: T[],
  deletedRecord: T | undefined
): T[] {
  if (!deletedRecord) return prev;
  if (prev.some((r) => r.id === deletedRecord.id)) return prev;
  return [...prev, deletedRecord];
}
