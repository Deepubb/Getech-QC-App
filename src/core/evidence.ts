import type { EvidenceFolder, EvidenceItem, EvidencePhoto, EvidenceSet } from './types';
import { fillFixture, hasFixture, showFixture } from './masterList';
import { safeName } from './names';

export { safeName };

/** Each photo of this item needs its own FT number, because its name holds {fixture}. */
export const needsFt = (item: Pick<EvidenceItem, 'name' | 'path'>) => [...item.path, item.name].some(hasFixture);

/** The item's name as shown on screen, with [FT] where each photo's FT number goes. */
export const itemName = (item: Pick<EvidenceItem, 'name'>) => safeName(showFixture(item.name));
export const itemPath = (item: Pick<EvidenceItem, 'path'>) => item.path.map((p) => safeName(showFixture(p))).filter(Boolean);

const photoPath = (item: Pick<EvidenceItem, 'path'>, photo: Pick<EvidencePhoto, 'ft'>) =>
  item.path.map((p) => safeName(fillFixture(p, photo.ft ?? ''))).filter(Boolean);

/**
 * File names for every photo in a folder, the way Windows numbers a group of files: the name with
 * that photo's FT number filled in, and when the same name comes up more than once in the same
 * place (several photos of one item, or a name the list repeats) every copy gets " (1)", " (2)", …
 * ("CCTV.jpg" alone; "CCTV (1).jpg", "CCTV (2).jpg" together; "Gripper_FT01.jpg", "Gripper_FT02.jpg").
 */
export function folderFileNames(folder: Pick<EvidenceFolder, 'items'>): Map<string, string> {
  const photos = folder.items.flatMap((item) =>
    item.photos.map((p) => {
      const base = safeName(fillFixture(item.name, p.ft ?? ''));
      return { id: p.id, base, key: [...photoPath(item, p), base].join('/').toLowerCase() };
    }),
  );
  const total = new Map<string, number>();
  for (const p of photos) total.set(p.key, (total.get(p.key) ?? 0) + 1);
  const seen = new Map<string, number>();
  const out = new Map<string, string>();
  for (const p of photos) {
    const n = (seen.get(p.key) ?? 0) + 1;
    seen.set(p.key, n);
    out.set(p.id, `${p.base}${total.get(p.key)! > 1 ? ` (${n})` : ''}.jpg`);
  }
  return out;
}

/** File names of one item's photos, numbered within its folder when given. */
export function photoFileNames(item: EvidenceItem, folder?: Pick<EvidenceFolder, 'items'>): string[] {
  const names = folderFileNames(folder ?? { items: [item] });
  return item.photos.map((p) => names.get(p.id) ?? '');
}

/** Where a photo goes inside the zip, e.g. "Machine Verification/EPSON". */
export const photoFolder = (folder: Pick<EvidenceFolder, 'name'>, item: Pick<EvidenceItem, 'path'>, photo: Pick<EvidencePhoto, 'ft'>) =>
  [safeName(folder.name), ...photoPath(item, photo)].join('/');

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

/** True when another item in the folder already has this subfolder and name. */
export function nameClash(folder: EvidenceFolder, path: string[], name: string, exceptId?: string): boolean {
  const key = (p: string[], n: string) => [...p, n].map((x) => safeName(x).toLowerCase()).join('/');
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
    {
      const names = folderFileNames(folder);
      return folder.items.flatMap((item) => item.photos.map((photo) => ({ path: `${photoFolder(folder, item, photo)}/${names.get(photo.id)}`, item, photo })));
    },
  );
}

/** Photos of {fixture} items still waiting for their FT number. Export is blocked until they have one. */
export function ftMissing(e: EvidenceSet): { folder: EvidenceFolder; item: EvidenceItem; photo: EvidencePhoto }[] {
  return e.folders.flatMap((folder) =>
    folder.items.filter(needsFt).flatMap((item) => item.photos.filter((p) => !safeName(p.ft)).map((photo) => ({ folder, item, photo }))),
  );
}

/** FT numbers already used on this machine, most recent first. */
export function usedFts(e: EvidenceSet): string[] {
  const photos = allItems(e)
    .flatMap((i) => i.photos)
    .filter((p) => safeName(p.ft))
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  return [...new Map(photos.map((p) => [safeName(p.ft).toLowerCase(), safeName(p.ft)])).values()];
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

/** Zip file name: the machine number, e.g. "SSDLV133". */
export function zipBaseName(e: Pick<EvidenceSet, 'machine' | 'number'>): string {
  return safeName(e.number) || safeName(e.machine) || 'Photo evidence';
}

export const setTitle = (e: Pick<EvidenceSet, 'machine' | 'number'>) => e.number || e.machine;
