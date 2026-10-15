import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { EvidenceSet } from '../core/types';
import { buildEvidencePack } from './evidencePack';

const MB = 1024 * 1024;
const set = (cats: [string, [string, number][]][]): EvidenceSet => ({
  id: 'e1', title: 'Conveyor A', machineCode: 'CONV-001', cwo: 'CWO-2041', customer: 'Acme', engineer: 'Deepak',
  createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', deviceId: 'd', exportedAt: null,
  categories: cats.map(([name, photos], ci) => ({ id: `c${ci}`, name, planned: [], photos: photos.map(([pname, bytes], pi) => ({ id: `p${ci}-${pi}`, name: pname, takenAt: '2026-10-15T08:00:00Z', bytes })) })),
});
const loader = (e: EvidenceSet) => async (id: string) => {
  const size = e.categories.flatMap((c) => c.photos).find((p) => p.id === id)!.bytes;
  return { full: new Blob([new Uint8Array(size).fill(7)]), thumb: new Blob([]) };
};
const unzip = async (b: Blob) => unzipSync(new Uint8Array(await b.arrayBuffer()));

describe('buildEvidencePack', () => {
  it('makes one folder per category and names files exactly as typed', async () => {
    const e = set([['Safety', [['E-stop button', 1000], ['Guard door', 1000]]], ['Functional', [['Run test', 2000]]], ['Empty', []]]);
    const pack = await buildEvidencePack(e, loader(e), 90);
    expect(pack.parts.map((p) => p.name)).toEqual(['Conveyor A.zip']);
    const files = Object.keys(await unzip(pack.parts[0].blob)).filter((f) => !f.endsWith('/'));
    expect(files.sort()).toEqual(['Functional/Run test.jpg', 'Safety/E-stop button.jpg', 'Safety/Guard door.jpg']);
  });

  it('splits into parts under the limit and keeps the folders in every part', async () => {
    const e = set([['Safety', [['A', 0.6 * MB], ['B', 0.6 * MB]]], ['Functional', [['C', 0.6 * MB]]]]);
    const pack = await buildEvidencePack(e, loader(e), 1);
    expect(pack.parts.map((p) => p.name)).toEqual(['Conveyor A_part1of3.zip', 'Conveyor A_part2of3.zip', 'Conveyor A_part3of3.zip']);
    expect(Object.keys(await unzip(pack.parts[2].blob))).toEqual(['Functional/C.jpg']);
    for (const p of pack.parts) expect(p.size).toBeLessThan(MB);
  });
});
