import { describe, expect, it } from 'vitest';
import { hasChanges, listHash, rebaseOnList } from './rebase';
import type { EvidenceFolder, EvidenceItem, ListFolder } from './types';

const item = (id: string, name: string, path: string[] = [], photos = 0, o: Partial<EvidenceItem> = {}): EvidenceItem => ({
  id, name, path, extra: false, na: false, photos: Array.from({ length: photos }, (_, n) => ({ id: `${id}-p${n}`, takenAt: '', bytes: 1 })), ...o,
});
const current: EvidenceFolder[] = [
  { id: 'f1', name: 'Machine Verification', items: [item('a', 'CCTV', [], 1), item('b', 'Base Structure'), item('c', 'Old Name', [], 2), item('d', 'Tower Light', [], 0, { na: true })] },
  { id: 'f2', name: 'Old Folder', items: [item('e', 'Gone')] },
];
const list: ListFolder[] = [
  { name: 'Machine Verification', shots: [{ path: [], name: 'CCTV' }, { path: [], name: 'New Name' }, { path: [], name: 'Tower Light' }, { path: ['EPSON'], name: 'Robot' }] },
];

describe('rebaseOnList', () => {
  const r = rebaseOnList(current, list);
  const mv = r.folders[0];

  it('keeps photos and N/A on names still in the list, in the new list order', () => {
    expect(mv.items.slice(0, 4).map((i) => [i.name, i.photos.length, i.na])).toEqual([
      ['CCTV', 1, false],
      ['New Name', 0, false],
      ['Tower Light', 0, true],
      ['Robot', 0, false],
    ]);
    expect(mv.items[0].id).toBe('a');
    expect(mv.id).toBe('f1');
  });

  it('keeps a removed name that has photos, marked as not on the list', () => {
    expect(mv.items.slice(4).map((i) => [i.name, i.photos.length, i.extra])).toEqual([['Old Name', 2, true]]);
  });

  it('drops removed names and folders that have no photos', () => {
    expect(r.folders.map((f) => f.name)).toEqual(['Machine Verification']);
    expect(r).toMatchObject({ added: 2, removed: 2, kept: 1 });
  });

  it('turns a photo added on site into a list item when the list gains that name', () => {
    const withExtra: EvidenceFolder[] = [{ id: 'f', name: 'F', items: [item('x', 'Extra shot', [], 1, { extra: true })] }];
    const r2 = rebaseOnList(withExtra, [{ name: 'F', shots: [{ path: [], name: 'Extra shot' }] }]);
    expect(r2.folders[0].items).toMatchObject([{ id: 'x', extra: false }]);
    expect(hasChanges(r2)).toBe(false);
  });

  it('reports no change when the list is the same', () => {
    const same = rebaseOnList(r.folders, list);
    expect([same.added, same.removed]).toEqual([0, 0]);
  });
});

describe('repeated names', () => {
  it('keeps each copy of a repeated name with its own photos', () => {
    const cur: EvidenceFolder[] = [{ id: 'f', name: 'ESD', items: [item('a', 'Belt', ['RPP'], 1), item('b', 'Belt', ['RPP'], 2)] }];
    const r = rebaseOnList(cur, [{ name: 'ESD', shots: [{ path: ['RPP'], name: 'Belt' }, { path: ['RPP'], name: 'Belt' }] }]);
    expect(r.folders[0].items.map((i) => [i.id, i.photos.length])).toEqual([['a', 1], ['b', 2]]);
    expect(hasChanges(r)).toBe(false);
  });
});

describe('listHash', () => {
  it('changes when the list changes', () => {
    expect(listHash(list)).toBe(listHash(structuredClone(list)));
    expect(listHash(list)).not.toBe(listHash([{ name: 'X', shots: [] }]));
  });
});
