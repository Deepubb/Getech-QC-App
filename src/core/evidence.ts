import type { EvidenceFolder, EvidenceItem, EvidencePhoto, EvidenceSet } from './types';
import { fillFixture } from './masterList';
import { safeName } from './names';

export { safeName };

/** The item's name with {fixture} filled in: the file name without ".jpg". */
export const itemName = (item: Pick<EvidenceItem, 'name'>, ft: string) => safeName(fillFixture(item.name, ft));
export const itemPath = (item: Pick<EvidenceItem, 'path'>, ft: string) => item.path.map((p) => safeName(fillFixture(p, ft))).filter(Boolean);

/** "CCTV.jpg", then "CCTV_2.jpg", "CCTV_3.jpg" for extra photos of the same item. */
export function photoFileName(item: Pick<EvidenceItem, 'name'>, index: number, ft: string): string {
  return `${itemName(item, ft)}${index ? `_${index + 1}` : ''}.jpg`;
}

/** Where an item's photos go inside the zip, e.g. "Machine Verification/EPSON". */
export const itemFolder = (folder: Pick<EvidenceFolder, 'name'>, item: Pick<EvidenceItem, 'path'>, ft: string) =>
  [safeName(folder.name), ...itemPath(item, ft)].join('/');

export const isTaken = (i: EvidenceItem) => i.photos.length > 0;
/** Still needed: on the list, no photo yet, not marked not applicable. */
export const isMissing = (i: EvidenceItem) => !i.extra && !i.na && !isTaken(i);

export interface Progress {
  total: number;
  taken: number;
  na: number;
  missing: number;
  photos: number;
}

export function progressOf(items: EvidenceItem[]): Progress {
  const listed = items.filter((i) => !i.extra);
  return {
    total: listed.length,
    taken: listed.filter(isTaken).length,
    na: listed.filter((i) => i.na && !isTaken(i)).length,
    missing: listed.filter(isMissing).length,
    photos: items.reduce((a, i) => a + i.photos.length, 0),
  };
}

export const allItems = (e: EvidenceSet) => e.folders.flatMap((f) => f.items);
export const evidenceProgress = (e: EvidenceSet) => progressOf(allItems(e));
export const evidencePhotoCount = (e: EvidenceSet) => allItems(e).reduce((a, i) => a + i.photos.length, 0);
export const evidenceBytes = (e: EvidenceSet) => allItems(e).reduce((a, i) => a + i.photos.reduce((b, p) => b + p.bytes, 0), 0);

/** The next item to photograph after `afterId` in list order, wrapping round to the top. */
export function nextMissing(items: EvidenceItem[], afterId?: string): EvidenceItem | undefined {
  const start = afterId ? items.findIndex((i) => i.id === afterId) + 1 : 0;
  return [...items.slice(start), ...items.slice(0, start)].find(isMissing);
}

/** Items grouped by subfolder, in the order the subfolders first appear in the list. */
export function groupByPath(items: EvidenceItem[]): { path: string[]; items: EvidenceItem[] }[] {
  const groups = new Map<string, { path: string[]; items: EvidenceItem[] }>();
  for (const i of items) {
    const k = i.path.join('/').toLowerCase();
    if (!groups.has(k)) groups.set(k, { path: i.path, items: [] });
    groups.get(k)!.items.push(i);
  }
  return [...groups.values()];
}

/** True when another item already gives the same folder and file name. */
export function nameClash(folder: EvidenceFolder, path: string[], name: string, ft: string, exceptId?: string): boolean {
  const key = (p: string[], n: string) => [...p.map((x) => safeName(fillFixture(x, ft))), safeName(fillFixture(n, ft))].join('/').toLowerCase();
  const k = key(path, name);
  return folder.items.some((i) => i.id !== exceptId && key(i.path, i.name) === k);
}

export interface ZipEntry {
  path: string;
  item: EvidenceItem;
  photo: EvidencePhoto;
}

/** Every photo at "<Folder>/<Subfolder>/<Name>.jpg". Nothing else goes in the zip. */
export function zipEntries(e: EvidenceSet): ZipEntry[] {
  return e.folders.flatMap((folder) =>
    folder.items.flatMap((item) => item.photos.map((photo, i) => ({ path: `${itemFolder(folder, item, e.ft)}/${photoFileName(item, i, e.ft)}`, item, photo }))),
  );
}

/** Two photos that would land on the same file in the zip. Export is blocked until fixed. */
export function zipClashes(e: EvidenceSet): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const z of zipEntries(e)) {
    const k = z.path.toLowerCase();
    if (seen.has(k)) out.push(z.path);
    seen.add(k);
  }
  return out;
}

/** Zip file name: machine and FT number, e.g. "SSDLV_FT1234". */
export function zipBaseName(e: Pick<EvidenceSet, 'machine' | 'ft'>): string {
  return [safeName(e.machine), safeName(e.ft)].filter(Boolean).join('_') || 'Photo evidence';
}

export const setTitle = (e: Pick<EvidenceSet, 'machine' | 'ft'>) => [e.machine, e.ft].filter(Boolean).join(' · ');
