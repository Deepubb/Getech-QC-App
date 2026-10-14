import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { EvidenceSet } from '../core/types';
import { buildEvidencePack } from './evidencePack';

const MB = 1024 * 1024;
const set = (sizes: number[]): EvidenceSet => ({
  id: 'e1',
  title: 'Conveyor A',
  machineCode: 'CONV-001',
  cwo: 'CWO-2041',
  customer: 'Acme',
  engineer: 'Deepak',
  createdAt: '2026-10-14T00:00:00Z',
  updatedAt: '2026-10-14T00:00:00Z',
  deviceId: 'd',
  exportedAt: null,
  shots: sizes.map((bytes, i) => ({ id: `s${i}`, name: i === 0 ? 'belt-tension' : '', photos: [{ id: `p${i}`, takenAt: '2026-10-14T00:00:00Z', bytes }] })),
});
const loader = (e: EvidenceSet) => async (id: string) => {
  const size = e.shots.flatMap((s) => s.photos).find((p) => p.id === id)!.bytes;
  return { full: new Blob([new Uint8Array(size).fill(7)]), thumb: new Blob([]) };
};

async function unzip(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

describe('buildEvidencePack', () => {
  it('builds one zip with named photos and a manifest', async () => {
    const e = set([1000, 2000]);
    const pack = await buildEvidencePack(e, loader(e), 90);
    expect(pack.parts).toHaveLength(1);
    expect(pack.parts[0].name).toMatch(/^CWO-2041_CONV-001_\d{4}-\d{2}-\d{2}_evidence\.zip$/);
    const files = await unzip(pack.parts[0].blob);
    expect(Object.keys(files).sort()).toEqual(['CWO-2041_CONV-001_002.jpg', 'belt-tension.jpg', 'manifest.json']);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    expect(manifest.files).toHaveLength(2);
    expect(manifest.files[0]).toMatchObject({ path: 'belt-tension.jpg', size: 1000, part: 1 });
    expect(manifest.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('splits into parts under the limit, with the manifest in part 1', async () => {
    const e = set([0.6 * MB, 0.6 * MB, 0.6 * MB]);
    const pack = await buildEvidencePack(e, loader(e), 1);
    expect(pack.parts.map((p) => p.name.replace(/^.*_evidence/, ''))).toEqual(['_part1of3.zip', '_part2of3.zip', '_part3of3.zip']);
    const first = await unzip(pack.parts[0].blob);
    expect(Object.keys(first)).toContain('manifest.json');
    const manifest = JSON.parse(strFromU8(first['manifest.json']));
    expect(manifest.files.map((f: { part: number }) => f.part)).toEqual([1, 2, 3]);
    for (const p of pack.parts) expect(p.size).toBeLessThan(1 * MB);
  });
});
