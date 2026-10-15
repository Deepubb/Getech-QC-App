import { describe, expect, it } from 'vitest';
import { groupByPath, nameClash, nextMissing, photoFileName, progressOf, safeName, zipBaseName, zipClashes, zipEntries } from './evidence';
import { treeLines } from './tree';
import type { EvidenceItem, EvidenceSet } from './types';

const ph = (id: string) => ({ id, takenAt: '2026-10-15T08:00:00Z', bytes: 100 });
const item = (id: string, name: string, path: string[] = [], photos: string[] = [], o: Partial<EvidenceItem> = {}): EvidenceItem => ({
  id, path, name, extra: false, na: false, photos: photos.map(ph), ...o,
});
const set = (folders: [string, EvidenceItem[]][], ft = 'FT1234'): EvidenceSet => ({
  id: 'e', machine: 'SSDLV', ft, engineer: '', createdAt: '', updatedAt: '', deviceId: '', exportedAt: null,
  folders: folders.map(([name, items], i) => ({ id: `f${i}`, name, items })),
});

describe('safeName', () => {
  it('keeps what was written, including spaces and brackets', () => {
    expect(safeName('Emergency stop button (left)')).toBe('Emergency stop button (left)');
  });
  it('drops only characters phones and PCs refuse in file names', () => {
    expect(safeName('Belt: tension / left?')).toBe('Belt tension left');
    expect(safeName('  E-stop.jpg ')).toBe('E-stop');
  });
});

describe('zipEntries', () => {
  const e = set([
    ['Machine Verification', [item('1', 'CCTV', [], ['a']), item('2', 'Loader Robot Specification', ['EPSON'], ['b', 'c']), item('3', 'KVM 1', ['KVM'])]],
    ['Function Verification', [item('4', 'ET_Inspection_{fixture}_ResultOK', ['Vision Master'], ['d'])]],
  ]);
  it('puts photos at Folder/Name.jpg, or Folder/Subfolder/Name.jpg, with _2 for extra photos', () => {
    expect(zipEntries(e).map((z) => z.path)).toEqual([
      'Machine Verification/CCTV.jpg',
      'Machine Verification/EPSON/Loader Robot Specification.jpg',
      'Machine Verification/EPSON/Loader Robot Specification_2.jpg',
      'Function Verification/Vision Master/ET_Inspection_FT1234_ResultOK.jpg',
    ]);
  });
  it('draws them as a folder tree', () => {
    expect(treeLines(zipEntries(e).map((z) => z.path))).toEqual([
      '├─ Machine Verification/',
      '│  ├─ CCTV.jpg',
      '│  └─ EPSON/',
      '│     ├─ Loader Robot Specification.jpg',
      '│     └─ Loader Robot Specification_2.jpg',
      '└─ Function Verification/',
      '   └─ Vision Master/',
      '      └─ ET_Inspection_FT1234_ResultOK.jpg',
    ]);
  });
  it('names the zip after the machine and FT number', () => {
    expect(zipBaseName(e)).toBe('SSDLV_FT1234');
  });
});

describe('progress', () => {
  const items = [item('1', 'A', [], ['p']), item('2', 'B'), item('3', 'C', [], [], { na: true }), item('4', 'D'), item('5', 'Extra', [], ['q'], { extra: true })];
  it('counts list items taken, not applicable and still missing; extras only add photos', () => {
    expect(progressOf(items)).toEqual({ total: 4, taken: 1, na: 1, missing: 2, photos: 2 });
  });
  it('finds the next missing item after the last one taken, wrapping to the top', () => {
    expect(nextMissing(items)?.id).toBe('2');
    expect(nextMissing(items, '2')?.id).toBe('4');
    expect(nextMissing(items, '4')?.id).toBe('2');
  });
  it('groups items by subfolder in list order', () => {
    const g = groupByPath([item('1', 'CCTV'), item('2', 'X', ['EPSON']), item('3', 'Y', ['epson']), item('4', 'KVM 1', ['KVM'])]);
    expect(g.map((x) => [x.path.join('/'), x.items.length])).toEqual([['', 1], ['EPSON', 2], ['KVM', 1]]);
  });
});

describe('name clashes', () => {
  const e = set([['Machine Verification', [item('1', 'CCTV', [], ['a']), item('2', 'Robot', ['EPSON'])]]]);
  it('spots a photo added on site that matches an existing name in the same place', () => {
    expect(nameClash(e.folders[0], [], 'cctv', e.ft)).toBe(true);
    expect(nameClash(e.folders[0], ['EPSON'], 'CCTV', e.ft)).toBe(false);
  });
  it('blocks export when two photos would get the same file', () => {
    const bad = set([['F', [item('1', 'A', [], ['a', 'b']), item('2', 'A_2', [], ['c'], { extra: true })]]]);
    expect(zipClashes(bad)).toEqual(['F/A_2.jpg']);
    expect(zipClashes(e)).toEqual([]);
  });
  it('numbers extra photos of one item', () => {
    expect([0, 1, 2].map((i) => photoFileName({ name: 'CCTV' }, i, ''))).toEqual(['CCTV.jpg', 'CCTV_2.jpg', 'CCTV_3.jpg']);
  });
});
