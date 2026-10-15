import { describe, expect, it } from 'vitest';
import { categoryTaken, evidenceProblems, nameTaken, safeName, toTake, zipBaseName, zipEntries } from './evidence';
import type { EvidenceCategory, EvidenceSet } from './types';

const ph = (id: string, name: string) => ({ id, name, takenAt: '2026-10-15T08:00:00Z', bytes: 100 });
const cat = (id: string, name: string, photos: [string, string][], planned: string[] = []): EvidenceCategory => ({ id, name, planned, photos: photos.map(([pid, n]) => ph(pid, n)) });
const set = (categories: EvidenceCategory[]): EvidenceSet => ({
  id: 'e', title: 'Conveyor A', machineCode: 'CONV-001', cwo: 'CWO-2041', customer: '', engineer: '',
  createdAt: '', updatedAt: '', deviceId: '', exportedAt: null, categories,
});

describe('safeName', () => {
  it('keeps what the engineer typed, including spaces and brackets', () => {
    expect(safeName('Emergency stop button (left)')).toBe('Emergency stop button (left)');
  });
  it('drops only characters phones and PCs refuse in file names', () => {
    expect(safeName('Belt: tension / left?')).toBe('Belt tension left');
    expect(safeName('  E-stop.jpg ')).toBe('E-stop');
    expect(safeName('...')).toBe('');
  });
});

describe('names within a category', () => {
  const c = cat('c', 'Safety', [['1', 'E-stop'], ['2', '']], ['E-stop', 'Guard door', 'Light curtain']);
  it('flags a name already used, ignoring case and the photo being renamed', () => {
    expect(nameTaken(c, 'e-stop')).toBe(true);
    expect(nameTaken(c, 'e-stop', '1')).toBe(false);
    expect(nameTaken(c, 'Guard door')).toBe(false);
  });
  it('lists planned names not yet taken', () => {
    expect(toTake(c)).toEqual(['Guard door', 'Light curtain']);
  });
  it('flags a category name already used', () => {
    const e = set([c, cat('d', 'Functional', [])]);
    expect(categoryTaken(e, 'safety')).toBe(true);
    expect(categoryTaken(e, 'Safety', 'c')).toBe(false);
  });
});

describe('zipEntries', () => {
  it('puts each photo at Category/Name.jpg and nothing else', () => {
    const e = set([cat('a', 'Safety', [['1', 'E-stop'], ['2', 'Guard door']]), cat('b', 'Functional', [['3', 'Run test 10 min']]), cat('c', 'Empty', [])]);
    expect(zipEntries(e).map((x) => x.path)).toEqual(['Safety/E-stop.jpg', 'Safety/Guard door.jpg', 'Functional/Run test 10 min.jpg']);
  });
});

describe('evidenceProblems', () => {
  it('blocks export on unnamed photos and duplicates in the same folder', () => {
    const e = set([cat('a', 'Safety', [['1', 'E-stop'], ['2', 'e-stop'], ['3', '']]), cat('b', 'Functional', [['4', 'E-stop']])]);
    expect(evidenceProblems(e).map((p) => p.kind)).toEqual(['duplicate', 'unnamed']);
  });
  it('blocks two categories with the same folder name', () => {
    const e = set([cat('a', 'Safety', [['1', 'A']]), cat('b', 'safety', [['2', 'B']])]);
    expect(evidenceProblems(e).map((p) => p.kind)).toEqual(['category']);
  });
  it('is happy when every photo has a unique name', () => {
    expect(evidenceProblems(set([cat('a', 'Safety', [['1', 'A'], ['2', 'B']])]))).toEqual([]);
  });
});

describe('zipBaseName', () => {
  it('uses the machine name, then the code', () => {
    expect(zipBaseName({ title: 'Conveyor A', machineCode: 'CONV-001' })).toBe('Conveyor A');
    expect(zipBaseName({ title: '', machineCode: 'CONV-001' })).toBe('CONV-001');
  });
});
