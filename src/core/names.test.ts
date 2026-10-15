import { describe, expect, it } from 'vitest';
import { checklistFileName, cleanName } from './names';

describe('cleanName', () => {
  it('keeps letters, digits, hyphen and underscore and trims the ends', () => {
    expect(cleanName('  CONV 001 (A) ')).toBe('CONV_001_A');
    expect(cleanName(undefined)).toBe('');
  });
});

describe('checklistFileName', () => {
  it('builds the report name from the machine code and date', () => {
    expect(checklistFileName('CONV-001', new Date(2026, 9, 14))).toBe('QC_Buyoff_CONV-001_20261014.xlsx');
  });
});
