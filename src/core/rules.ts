import { evidenceBytes, evidencePhotoCount } from './evidence';
import type { Checklist, ChecklistItem, EvidenceSet } from './types';

export function remarksOk(it: Pick<ChecklistItem, 'remarksRule' | 'remarks' | 'result'>): boolean {
  if (it.remarksRule === 'N') return true;
  const has = it.remarks.trim().length > 0;
  if (it.remarksRule === 'Y') return has;
  return it.result !== 'nok' || has;
}

/** Why an item cannot be saved yet. Empty means it can be saved. */
export function itemProblems(it: ChecklistItem): string[] {
  const out: string[] = [];
  if (it.result === 'pending') out.push('Choose OK, NOK or N/A');
  if (!remarksOk(it)) out.push(it.remarksRule === 'M' ? 'Remarks are required when the result is NOK' : 'Add remarks');
  return out;
}

export const canSaveItem = (it: ChecklistItem) => itemProblems(it).length === 0;

export const doneCount = (c: Checklist) => c.items.filter((i) => i.completedAt).length;
export const nokCount = (c: Checklist) => c.items.filter((i) => i.completedAt && i.result === 'nok').length;

export function checklistLabel(c: Checklist): 'exported' | 'completed' | 'in_progress' {
  if (c.status === 'completed' && c.exportedAt && c.exportedAt >= c.updatedAt) return 'exported';
  return c.status;
}

export const photoCount = evidencePhotoCount;
export const photoBytes = evidenceBytes;

export function evidenceLabel(e: EvidenceSet): 'empty' | 'exported' | 'not_exported' {
  if (!photoCount(e)) return 'empty';
  return e.exportedAt && e.exportedAt >= e.updatedAt ? 'exported' : 'not_exported';
}

export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}
