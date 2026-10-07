// Bill-wise settlement for a party account.
//
// Every ledger entry is either a debit (party owes us more: sales invoice,
// debit note, purchase return, payment we made, positive opening balance) or a
// credit (party owes us less: receipt, sales return, credit note, purchase
// bill, negative opening balance). Credits are matched against debits:
//   1. entries that name a target (a receipt against a bill, a return against
//      its invoice) settle that target first;
//   2. whatever is left is matched oldest-first.
// After matching, at most one side has open amounts — that is the bill-wise
// outstanding, and it always adds up to the ledger balance.

import { round2 } from './totals.js';

export interface SettlementItem {
  key: string;
  side: 'debit' | 'credit';
  date: string; // YYYY-MM-DD
  amount: number;
  /** Key of an item on the opposite side this entry should settle first. */
  targetKey?: string | null;
  /** Tie-breaker for same-day entries (e.g. created_at millis). */
  seq?: number;
}

export interface SettlementResult {
  /** Remaining open amount per item key. */
  remaining: Map<string, number>;
}

const EPS = 0.005;

function byDate(a: SettlementItem, b: SettlementItem) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.seq ?? 0) - (b.seq ?? 0);
}

export function settle(items: SettlementItem[]): SettlementResult {
  const remaining = new Map<string, number>();
  const byKey = new Map<string, SettlementItem>();
  for (const item of items) {
    remaining.set(item.key, round2(Math.max(item.amount, 0)));
    byKey.set(item.key, item);
  }

  const apply = (a: SettlementItem, b: SettlementItem) => {
    const ra = remaining.get(a.key)!;
    const rb = remaining.get(b.key)!;
    const used = Math.min(ra, rb);
    if (used <= EPS) return;
    remaining.set(a.key, round2(ra - used));
    remaining.set(b.key, round2(rb - used));
  };

  // 1. Targeted settlement, in date order so earlier entries claim first.
  for (const item of [...items].sort(byDate)) {
    if (!item.targetKey) continue;
    const target = byKey.get(item.targetKey);
    if (!target || target.side === item.side) continue;
    apply(item, target);
  }

  // 2. Oldest-first matching of whatever remains.
  const debits = items.filter((i) => i.side === 'debit').sort(byDate);
  const credits = items.filter((i) => i.side === 'credit').sort(byDate);
  let d = 0;
  let c = 0;
  while (d < debits.length && c < credits.length) {
    if (remaining.get(debits[d].key)! <= EPS) { d++; continue; }
    if (remaining.get(credits[c].key)! <= EPS) { c++; continue; }
    apply(debits[d], credits[c]);
  }

  for (const [key, value] of remaining) {
    if (value <= EPS) remaining.set(key, 0);
  }
  return { remaining };
}
