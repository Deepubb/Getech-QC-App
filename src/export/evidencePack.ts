import { zipSync, type Zippable } from 'fflate';
import { zipBaseName, zipEntries } from '../core/evidence';
import type { EvidenceSet, StoredPhoto } from '../core/types';
import { planParts, partFileName } from './plan';

export interface PackPart {
  name: string;
  blob: Blob;
  size: number;
  photoCount: number;
}

export interface EvidencePack {
  evidenceId: string;
  sourceUpdatedAt: string;
  parts: PackPart[];
  totalBytes: number;
}

/**
 * Builds the evidence zip(s). Inside, each photo sits at "<Category>/<Photo name>.jpg" and nothing else
 * is added. Photos are already JPEG, so they are stored, not recompressed. Parts are built one at a
 * time so only one part's photos are held in memory on the phone.
 */
export async function buildEvidencePack(
  e: EvidenceSet,
  loadPhoto: (id: string) => Promise<StoredPhoto | null>,
  splitMB: number,
  onProgress?: (message: string) => void,
): Promise<EvidencePack> {
  const entries = zipEntries(e);
  const limit = Math.max(0.1, splitMB) * 1024 * 1024;
  const plan = planParts(entries.map((x) => x.photo.bytes || 1), limit, 4096);
  const base = zipBaseName(e);

  const parts: PackPart[] = [];
  for (let p = 0; p < plan.length; p++) {
    const zip: Zippable = {};
    let count = 0;
    for (const i of plan[p]) {
      onProgress?.(`Adding photo ${i + 1} of ${entries.length}`);
      const stored = await loadPhoto(entries[i].photo.id);
      if (!stored) continue;
      zip[entries[i].path] = [new Uint8Array(await stored.full.arrayBuffer()), { level: 0, mtime: new Date(entries[i].photo.takenAt) }];
      count++;
    }
    onProgress?.(plan.length > 1 ? `Zipping part ${p + 1} of ${plan.length}` : 'Zipping photos');
    const bytes = zipSync(zip);
    parts.push({ name: partFileName(base, p, plan.length), blob: new Blob([bytes as BlobPart], { type: 'application/zip' }), size: bytes.length, photoCount: count });
  }
  return { evidenceId: e.id, sourceUpdatedAt: e.updatedAt, parts, totalBytes: parts.reduce((a, p) => a + p.size, 0) };
}
