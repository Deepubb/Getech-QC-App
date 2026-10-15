import { describe, expect, it } from 'vitest';
import { ftMissing, groupByPath, itemName, nameClash, needsFt, nextMissing, photoFileNames, progressOf, safeName, usedFts, zipBaseName, zipClashes, zipEntries } from './evidence';
import { treeLines } from './tree';
import type { EvidenceItem, EvidenceSet } from './types';

const ph = (id: string, ft?: string, takenAt = '2026-10-15T08:00:00Z') => ({ id, takenAt, bytes: 100, ...(ft !== undefined ? { ft } : {}) });
const item = (id: string, name: string, path: string[] = [], photos: string[] = [], o: Partial<EvidenceItem> = {}): EvidenceItem => ({
  id, path, name, extra: false, na: false, photos: photos.map((p) => ph(p)), ...o,
});
const set = (folders: [string, EvidenceItem[]][], number = 'SSDLV133'): EvidenceSet => ({
  id: 'e', machine: 'SSDLV', number, engineer: '', createdAt: '', updatedAt: '', deviceId: '', exportedAt: null,
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

describe('FT numbers per photo', () => {
  const gripper = item('g', 'Loader Robot_Gripper_{fixture}', ['EPSON'], [], { photos: [ph('a', 'FT01'), ph('b', 'FT02'), ph('c', 'FT01'), ph('d')] });
  it('knows which names need an FT number', () => {
    expect(needsFt(gripper)).toBe(true);
    expect(needsFt(item('x', 'CCTV'))).toBe(false);
  });
  it('shows [FT] where the FT number goes', () => {
    expect(itemName(gripper)).toBe('Loader Robot_Gripper_[FT]');
  });
  it('names each photo with its own FT number, numbering repeats', () => {
    expect(photoFileNames(gripper)).toEqual([
      'Loader Robot_Gripper_FT01.jpg',
      'Loader Robot_Gripper_FT02.jpg',
      'Loader Robot_Gripper_FT01_2.jpg',
      'Loader Robot_Gripper_{fixture}.jpg',
    ]);
  });
  it('lists photos still waiting for an FT number, and the FT numbers used, newest first', () => {
    const e = set([['Machine Verification', [gripper]]]);
    expect(ftMissing(e).map((x) => x.photo.id)).toEqual(['d']);
    const e2 = set([['M', [item('i', 'X_{fixture}', [], [], { photos: [ph('1', 'FT01', '2026-10-15T08:00:00Z'), ph('2', 'ft09', '2026-10-15T09:00:00Z')] })]]]);
    expect(usedFts(e2)).toEqual(['ft09', 'FT01']);
  });
});

describe('zipEntries', () => {
  const e = set([
    ['Machine Verification', [item('1', 'CCTV', [], ['a']), item('2', 'Loader Robot Specification', ['EPSON'], ['b', 'c']), item('3', 'KVM 1', ['KVM'])]],
    ['Function Verification', [item('4', 'ET_Inspection_{fixture}_ResultOK', ['Vision Master'], [], { photos: [ph('d', 'FT07')] })]],
  ]);
  it('puts photos at Folder/Name.jpg, or Folder/Subfolder/Name.jpg, with _2 for extra photos', () => {
    expect(zipEntries(e).map((z) => z.path)).toEqual([
      'Machine Verification/CCTV.jpg',
      'Machine Verification/EPSON/Loader Robot Specification.jpg',
      'Machine Verification/EPSON/Loader Robot Specification_2.jpg',
      'Function Verification/Vision Master/ET_Inspection_FT07_ResultOK.jpg',
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
      '      └─ ET_Inspection_FT07_ResultOK.jpg',
    ]);
  });
  it('names the zip after the machine number', () => {
    expect(zipBaseName(e)).toBe('SSDLV133');
    expect(zipBaseName({ machine: 'SSDLV', number: '' })).toBe('SSDLV');
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
    expect(nameClash(e.folders[0], [], 'cctv')).toBe(true);
    expect(nameClash(e.folders[0], ['EPSON'], 'CCTV')).toBe(false);
  });
  it('blocks export when two photos would get the same file', () => {
    const bad = set([['F', [item('1', 'A', [], ['a', 'b']), item('2', 'A_2', [], ['c'], { extra: true })]]]);
    expect(zipClashes(bad)).toEqual(['F/A_2.jpg']);
    expect(zipClashes(e)).toEqual([]);
  });
  it('numbers extra photos of one item', () => {
    expect(photoFileNames(item('x', 'CCTV', [], ['a', 'b', 'c']))).toEqual(['CCTV.jpg', 'CCTV_2.jpg', 'CCTV_3.jpg']);
  });
});
