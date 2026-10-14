import { describe, expect, it } from 'vitest';
import { checklistFileName, cleanName, duplicateNames, evidenceFiles, evidenceZipPrefix } from './names';
import type { Shot } from './types';

const photo = (id: string) => ({ id, takenAt: '2026-10-14T10:00:00.000Z', bytes: 100 });
const shot = (name: string, n: number, id = name || Math.random().toString()): Shot => ({ id, name, photos: Array.from({ length: n }, (_, i) => photo(`${id}-${i}`)) });

describe('cleanName', () => {
  it('keeps letters, digits, hyphen and underscore and strips the extension', () => {
    expect(cleanName('  belt tension (left).JPG ')).toBe('belt_tension_left');
    expect(cleanName('motor-voltage.jpeg')).toBe('motor-voltage');
    expect(cleanName('__a__')).toBe('a');
    expect(cleanName(undefined)).toBe('');
  });
  it('caps names at 100 characters', () => {
    expect(cleanName('x'.repeat(150))).toHaveLength(100);
  });
});

describe('evidenceFiles', () => {
  const base = { cwo: 'CWO-2041', machineCode: 'CONV-001' };

  it('uses typed names, adds -2 for extra photos and auto-names the rest', () => {
    const files = evidenceFiles({ ...base, shots: [shot('belt-tension', 2), shot('', 1), shot('run test', 1)] });
    expect(files.map((f) => f.filename)).toEqual(['belt-tension.jpg', 'belt-tension-2.jpg', 'CWO-2041_CONV-001_002.jpg', 'run_test.jpg']);
  });

  it('skips empty shots but keeps numbering by shot position', () => {
    const files = evidenceFiles({ ...base, shots: [shot('slot', 0), shot('', 1)] });
    expect(files.map((f) => f.filename)).toEqual(['CWO-2041_CONV-001_002.jpg']);
  });

  it('never produces the same file name twice, ignoring case', () => {
    const files = evidenceFiles({ ...base, shots: [shot('Guard', 1, 'a'), shot('guard', 1, 'b'), shot('GUARD', 1, 'c')] });
    const names = files.map((f) => f.filename.toLowerCase());
    expect(new Set(names).size).toBe(3);
    expect(files.map((f) => f.filename)).toEqual(['Guard.jpg', 'guard_2.jpg', 'GUARD_3.jpg']);
  });

  it('falls back to "evidence" when there is no CWO or machine code', () => {
    const files = evidenceFiles({ cwo: '', machineCode: '', shots: [shot('', 1)] });
    expect(files[0].filename).toBe('evidence_001.jpg');
  });
});

describe('duplicateNames', () => {
  it('flags names used by more than one shot', () => {
    expect([...duplicateNames([shot('a', 0, '1'), shot('A', 0, '2'), shot('b', 0, '3'), shot('', 0, '4'), shot('', 0, '5')])]).toEqual(['a']);
  });
});

describe('file names', () => {
  const d = new Date(2026, 9, 14);
  it('builds the zip prefix and report name', () => {
    expect(evidenceZipPrefix({ cwo: 'CWO 2041', machineCode: 'CONV-001' }, d)).toBe('CWO_2041_CONV-001_2026-10-14_evidence');
    expect(checklistFileName('CONV-001', d)).toBe('QC_Buyoff_CONV-001_20261014.xlsx');
  });
});
