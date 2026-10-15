import { uid } from './ids';
import type { EvidenceFolder, EvidenceItem, ListFolder } from './types';

const key = (folder: string, path: string[], name: string) => [folder, ...path, name].map((p) => p.trim().toLowerCase()).join('/');

/** A short fingerprint of a list, to remember which version an engineer chose to ignore. */
export function listHash(folders: ListFolder[]): string {
  const s = JSON.stringify(folders);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}-${(h >>> 0).toString(36)}`;
}

export interface Rebased {
  folders: EvidenceFolder[];
  /** New names from the list, now waiting to be taken. */
  added: number;
  /** Names no longer on the list that had no photos; they disappear. */
  removed: number;
  /** Names no longer on the list that have photos; they stay, marked as not on the list. */
  kept: number;
}

/**
 * Brings a machine already in progress onto a newer master list without losing a photo.
 * Matching is by folder, subfolder and name as written in the list; a renamed photo counts
 * as one removed and one added, so its photos stay under the old name.
 */
export function rebaseOnList(current: EvidenceFolder[], list: ListFolder[]): Rebased {
  const old = new Map<string, { folder: EvidenceFolder; item: EvidenceItem }>();
  for (const f of current) for (const i of f.items) old.set(key(f.name, i.path, i.name), { folder: f, item: i });
  const used = new Set<string>();
  let added = 0;

  const folders: EvidenceFolder[] = list.map((lf) => {
    const existing = current.find((f) => f.name.trim().toLowerCase() === lf.name.trim().toLowerCase());
    const items = lf.shots.map((s): EvidenceItem => {
      const k = key(lf.name, s.path, s.name);
      const match = old.get(k);
      if (match && !used.has(k)) {
        used.add(k);
        return { ...match.item, path: s.path, name: s.name, extra: false };
      }
      added++;
      return { id: uid(), path: s.path, name: s.name, extra: false, na: false, photos: [] };
    });
    return { id: existing?.id ?? uid(), name: lf.name, items };
  });

  let removed = 0;
  let kept = 0;
  for (const f of current) {
    for (const i of f.items) {
      const k = key(f.name, i.path, i.name);
      if (used.has(k)) continue;
      if (!i.photos.length && !i.extra) {
        removed++;
        continue;
      }
      if (!i.extra) kept++;
      let target = folders.find((x) => x.name.trim().toLowerCase() === f.name.trim().toLowerCase());
      if (!target) folders.push((target = { id: f.id, name: f.name, items: [] }));
      target.items.push({ ...i, extra: true });
    }
  }
  return { folders, added, removed, kept };
}

export const hasChanges = (r: Rebased) => r.added + r.removed + r.kept > 0;
