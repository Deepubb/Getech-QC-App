import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { EvidenceSet } from '../core/types';
import { buildEvidencePack } from './evidencePack';

const MB = 1024 * 1024;
const set = (folders: [string, [string, string[], number][]][]): EvidenceSet => ({
  id: 'e1', machine: 'SSDLV', number: 'SSDLV133', engineer: 'Deepak',
  createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', deviceId: 'd', exportedAt: null,
  folders: folders.map(([name, items], fi) => ({
    id: `f${fi}`,
    name,
    items: items.map(([iname, path, bytes], ii) => ({ id: `i${fi}-${ii}`, name: iname, path, extra: false, na: false, photos: bytes ? [{ id: `p${fi}-${ii}`, takenAt: '2026-10-15T08:00:00Z', bytes }] : [] })),
  })),
});
const loader = (e: EvidenceSet) => async (id: string) => {
  const size = e.folders.flatMap((f) => f.items.flatMap((i) => i.photos)).find((p) => p.id === id)!.bytes;
  return { full: new Blob([new Uint8Array(size).fill(7)]), thumb: new Blob([]) };
};
const unzip = async (b: Blob) => unzipSync(new Uint8Array(await b.arrayBuffer()));

describe('buildEvidencePack', () => {
  it('lays the zip out like the master sheet and adds nothing else', async () => {
    const e = set([
      ['Machine Verification', [['CCTV', [], 1000], ['Loader Robot Specification', ['EPSON'], 1000], ['KVM 1', ['KVM'], 0]]],
      ['ESD Measurement', [['EPSON_Loader', ['ESD'], 1000], ['EPSON_Loader', ['Ground'], 1000]]],
    ]);
    const pack = await buildEvidencePack(e, loader(e), 90);
    expect(pack.parts.map((p) => p.name)).toEqual(['SSDLV133.zip']);
    const files = Object.keys(await unzip(pack.parts[0].blob)).filter((f) => !f.endsWith('/'));
    expect(files).toEqual([
      'Machine Verification/CCTV.jpg',
      'Machine Verification/EPSON/Loader Robot Specification.jpg',
      'ESD Measurement/ESD/EPSON_Loader.jpg',
      'ESD Measurement/Ground/EPSON_Loader.jpg',
    ]);
  });

  it('splits into parts under the limit and keeps the folders in every part', async () => {
    const e = set([['Safety', [['A', [], 0.6 * MB], ['B', [], 0.6 * MB]]], ['Functional', [['C', ['Sub'], 0.6 * MB]]]]);
    const pack = await buildEvidencePack(e, loader(e), 1);
    expect(pack.parts.map((p) => p.name)).toEqual(['SSDLV133_part1of3.zip', 'SSDLV133_part2of3.zip', 'SSDLV133_part3of3.zip']);
    expect(Object.keys(await unzip(pack.parts[2].blob))).toEqual(['Functional/Sub/C.jpg']);
  });
});
