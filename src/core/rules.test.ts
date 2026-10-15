import { describe, expect, it } from 'vitest';
import { checklistLabel, evidenceLabel, itemProblems, remarksOk } from './rules';
import type { Checklist, ChecklistItem, EvidenceSet } from './types';

const item = (patch: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: 'i',
  itemNo: 'S-01',
  category: 'Safety',
  procedure: 'E-stop',
  expected: '',
  remarksRule: 'N',
  failInstruction: '',
  result: 'pending',
  remarks: '',
  completedAt: null,
  ...patch,
});

describe('item rules', () => {
  it('needs a result', () => {
    expect(itemProblems(item())).toEqual(['Choose OK, NOK or N/A']);
    expect(itemProblems(item({ result: 'na' }))).toEqual([]);
  });
  it('remarks rule Y always needs remarks', () => {
    expect(remarksOk(item({ remarksRule: 'Y', result: 'ok' }))).toBe(false);
    expect(remarksOk(item({ remarksRule: 'Y', result: 'ok', remarks: ' ok ' }))).toBe(true);
  });
  it('remarks rule M needs remarks only on NOK', () => {
    expect(remarksOk(item({ remarksRule: 'M', result: 'ok' }))).toBe(true);
    expect(itemProblems(item({ remarksRule: 'M', result: 'nok' }))).toEqual(['Remarks are required when the result is NOK']);
    expect(remarksOk(item({ remarksRule: 'M', result: 'nok', remarks: 'loose belt' }))).toBe(true);
  });
});

describe('labels', () => {
  const c = (patch: Partial<Checklist>): Checklist =>
    ({ status: 'in_progress', exportedAt: null, updatedAt: '2026-10-14T10:00:00Z', items: [] as ChecklistItem[], ...patch }) as Checklist;
  it('treats an export older than the last edit as not exported', () => {
    expect(checklistLabel(c({ status: 'completed' }))).toBe('completed');
    expect(checklistLabel(c({ status: 'completed', exportedAt: '2026-10-14T11:00:00Z' }))).toBe('exported');
    expect(checklistLabel(c({ status: 'completed', exportedAt: '2026-10-14T09:00:00Z' }))).toBe('completed');
  });
  it('labels evidence sets', () => {
    const e = (patch: Partial<EvidenceSet>) => ({ categories: [], exportedAt: null, updatedAt: '2026-10-14T10:00:00Z', ...patch }) as EvidenceSet;
    expect(evidenceLabel(e({}))).toBe('empty');
    const categories = [{ id: 'c', name: 'Safety', planned: [], photos: [{ id: 'p', name: 'A', takenAt: '', bytes: 1 }] }];
    expect(evidenceLabel(e({ categories }))).toBe('not_exported');
    expect(evidenceLabel(e({ categories, exportedAt: '2026-10-14T10:00:00Z' }))).toBe('exported');
  });
});
