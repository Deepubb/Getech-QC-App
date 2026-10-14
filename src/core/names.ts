import type { EvidenceSet, PhotoRef, Shot } from './types';

/** Letters, digits, hyphen and underscore only; no extension; at most 100 characters. */
export function cleanName(input: string | null | undefined): string {
  return String(input ?? '')
    .trim()
    .replace(/\.(jpe?g|png|heic)$/i, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Base for automatic photo names, e.g. CWO-2041_CONV-001. */
export function evidencePrefix(e: Pick<EvidenceSet, 'cwo' | 'machineCode'>): string {
  return [cleanName(e.cwo), cleanName(e.machineCode)].filter(Boolean).join('_') || 'evidence';
}

export function autoShotName(e: Pick<EvidenceSet, 'cwo' | 'machineCode'>, shotIndex: number): string {
  return `${evidencePrefix(e)}_${pad(shotIndex + 1, 3)}`;
}

export interface EvidenceFile {
  shot: Shot;
  photo: PhotoRef;
  filename: string;
}

/**
 * Final file names for every photo, in shot order.
 * Typed name wins; otherwise an automatic name. Extra photos in a shot get -2, -3.
 * Collisions (ignoring case) get _2, _3 so no file is ever overwritten in the zip.
 */
export function evidenceFiles(e: Pick<EvidenceSet, 'cwo' | 'machineCode' | 'shots'>): EvidenceFile[] {
  const used = new Set<string>();
  const out: EvidenceFile[] = [];
  e.shots.forEach((shot, si) => {
    shot.photos.forEach((photo, k) => {
      let base = cleanName(shot.name) || autoShotName(e, si);
      if (k > 0) base += `-${k + 1}`;
      let name = base;
      let n = 2;
      while (used.has(name.toLowerCase())) name = `${base}_${n++}`;
      used.add(name.toLowerCase());
      out.push({ shot, photo, filename: `${name}.jpg` });
    });
  });
  return out;
}

export function duplicateNames(shots: Shot[]): Set<string> {
  const counts = new Map<string, number>();
  for (const s of shots) {
    const n = cleanName(s.name).toLowerCase();
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, c]) => c > 1).map(([n]) => n));
}

export function isDuplicateName(shots: Shot[], shot: Shot): boolean {
  const n = cleanName(shot.name).toLowerCase();
  return !!n && duplicateNames(shots).has(n);
}

export function evidenceZipPrefix(e: Pick<EvidenceSet, 'cwo' | 'machineCode'>, date = new Date()): string {
  return `${evidencePrefix(e)}_${ymd(date)}_evidence`;
}

export function checklistFileName(machineCode: string, date = new Date()): string {
  return `QC_Buyoff_${cleanName(machineCode) || 'machine'}_${ymd(date).replace(/-/g, '')}.xlsx`;
}
