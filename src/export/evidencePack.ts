import { zipSync, strToU8, type Zippable } from 'fflate';
import { evidenceFiles, evidenceZipPrefix } from '../core/names';
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

async function sha256(bytes: Uint8Array): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/**
 * Builds the evidence zip(s). Photos are already JPEG, so they are stored, not recompressed.
 * Two passes keep memory flat on phones: the first hashes each photo for the manifest,
 * the second reads and zips one part at a time, so only one part's photos are held at once.
 */
export async function buildEvidencePack(
  e: EvidenceSet,
  loadPhoto: (id: string) => Promise<StoredPhoto | null>,
  splitMB: number,
  onProgress?: (message: string) => void,
): Promise<EvidencePack> {
  const files = evidenceFiles(e);
  const prefix = evidenceZipPrefix(e);
  const limit = Math.max(0.1, splitMB) * 1024 * 1024;
  const plan = planParts(files.map((f) => f.photo.bytes || 1), limit, 2048 + files.length * 200);
  const partOf = new Map<number, number>();
  plan.forEach((indexes, p) => indexes.forEach((i) => partOf.set(i, p + 1)));

  const manifest = {
    app: 'getech-qc-web',
    exportedAt: new Date().toISOString(),
    title: e.title,
    machineCode: e.machineCode,
    cwo: e.cwo,
    customer: e.customer,
    engineer: e.engineer,
    parts: plan.length,
    files: [] as { path: string; shotName: string; takenAt: string; size: number; part: number; sha256: string }[],
  };
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Checking photo ${i + 1} of ${files.length}`);
    const stored = await loadPhoto(files[i].photo.id);
    if (!stored) continue;
    const bytes = new Uint8Array(await stored.full.arrayBuffer());
    manifest.files.push({
      path: files[i].filename,
      shotName: files[i].shot.name,
      takenAt: files[i].photo.takenAt,
      size: bytes.length,
      part: partOf.get(i) ?? 1,
      sha256: await sha256(bytes),
    });
  }

  const parts: PackPart[] = [];
  for (let p = 0; p < plan.length; p++) {
    onProgress?.(plan.length > 1 ? `Zipping part ${p + 1} of ${plan.length}` : 'Zipping photos');
    const zip: Zippable = {};
    if (p === 0) zip['manifest.json'] = [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }];
    let count = 0;
    for (const i of plan[p]) {
      const stored = await loadPhoto(files[i].photo.id);
      if (!stored) continue;
      zip[files[i].filename] = [new Uint8Array(await stored.full.arrayBuffer()), { level: 0 }];
      count++;
    }
    const bytes = zipSync(zip);
    parts.push({ name: partFileName(prefix, p, plan.length), blob: new Blob([bytes as BlobPart], { type: 'application/zip' }), size: bytes.length, photoCount: count });
  }

  return { evidenceId: e.id, sourceUpdatedAt: e.updatedAt, parts, totalBytes: parts.reduce((a, p) => a + p.size, 0) };
}
