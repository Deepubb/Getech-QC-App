import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { diffLists, fillFixture, parseCell, sheetToList, shotCount, usesFixture } from './masterList';
import { readMasterWorkbook } from './readWorkbook';

/** Shaped like the SSDLV master sheet: one column per main folder, ">" for subfolders, {fixture} placeholders. */
const SSDLV = [
  ['Function Verification', 'Machine Verification', 'Software Verification', 'ESD Measurement'],
  ['Arm reached limit_Loader', 'AVT PC Mounting', 'EPSON RC Projects', 'ESD > Drive Drop Pad'],
  ['Vision Master > ET_Inspection_{fixture}_ResultOK', 'CCTV', 'AVT > PC1_Label_Vision', 'ESD > EPSON_Loader'],
  ['', 'EPSON > Loader Robot Specification', '', 'Ground > EPSON_Loader'],
  ['', 'KVM > KVM 1', '', 'Ground > Ground'],
];

describe('parseCell', () => {
  it('treats a name without ">" as the photo name', () => {
    expect(parseCell('CCTV')).toEqual({ path: [], name: 'CCTV' });
  });
  it('puts the left of ">" in a subfolder and the right as the photo name', () => {
    expect(parseCell('EPSON > Loader Robot Specification')).toEqual({ path: ['EPSON'], name: 'Loader Robot Specification' });
    expect(parseCell('ESD>Drive Drop Pad')).toEqual({ path: ['ESD'], name: 'Drive Drop Pad' });
  });
  it('ignores empty cells and an empty name', () => {
    expect(parseCell('')).toBeNull();
    expect(parseCell('EPSON > ')).toBeNull();
  });
});

describe('sheetToList', () => {
  const list = sheetToList('SSDLV', SSDLV)!;
  it('names the machine after the sheet and makes one folder per column', () => {
    expect(list.machine).toBe('SSDLV');
    expect(list.folders.map((f) => [f.name, f.shots.length])).toEqual([
      ['Function Verification', 2],
      ['Machine Verification', 4],
      ['Software Verification', 2],
      ['ESD Measurement', 4],
    ]);
    expect(shotCount(list)).toBe(12);
  });
  it('keeps the same photo name in two different subfolders', () => {
    const esd = list.folders[3].shots;
    expect(esd.filter((s) => s.name === 'EPSON_Loader').map((s) => s.path)).toEqual([['ESD'], ['Ground']]);
  });
  it('drops a repeated name with a warning', () => {
    const l = sheetToList('M', [['Safety'], ['E-stop'], ['e-stop']])!;
    expect(l.folders[0].shots).toHaveLength(1);
    expect(l.warnings[0]).toMatch(/listed twice/);
  });
  it('skips a sheet with no headings', () => {
    expect(sheetToList('Empty', [])).toBeNull();
  });
});

describe('{fixture}', () => {
  const list = sheetToList('SSDLV', SSDLV)!;
  it('is found in the list and filled from the FT number', () => {
    expect(usesFixture(list)).toBe(true);
    expect(fillFixture('ET_Inspection_{fixture}_ResultOK', 'FT1234')).toBe('ET_Inspection_FT1234_ResultOK');
    expect(fillFixture('ET_Inspection_{fixture}_ResultOK', '')).toBe('ET_Inspection_{fixture}_ResultOK');
  });
});

describe('diffLists', () => {
  it('counts photo names added and removed by a new upload', () => {
    const before = sheetToList('M', [['A', 'B'], ['x', 'y']])!;
    const after = sheetToList('M', [['A', 'B'], ['x', 'z'], ['w', '']])!;
    expect(diffLists(before, after)).toEqual({ added: 2, removed: 1 });
  });
});

describe('readMasterWorkbook', () => {
  it('reads every sheet as a machine', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SSDLV), 'SSDLV');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Safety'], ['E-stop']]), 'SSDHV');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Notes');
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const r = readMasterWorkbook(data);
    expect(r.lists.map((l) => [l.machine, shotCount(l)])).toEqual([
      ['SSDLV', 12],
      ['SSDHV', 1],
    ]);
    expect(r.skipped).toEqual(['Notes']);
  });
});
