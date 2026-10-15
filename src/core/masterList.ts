import { safeName } from './names';
import type { ListFolder, ListShot, MasterList } from './types';

/**
 * A master sheet: the first row holds the main folders (one per column), and every cell below
 * a heading is a photo for that folder. "EPSON > Loader Robot" puts the photo "Loader Robot" in
 * the subfolder "EPSON"; a cell without ">" is just the photo name.
 */
export interface ParsedList {
  machine: string;
  folders: ListFolder[];
  warnings: string[];
}

export const shotKey = (s: ListShot) => [...s.path, s.name].map((p) => p.toLowerCase()).join('/');

/** Reads one cell. Returns null when nothing usable is left after cleaning. */
export function parseCell(cell: unknown): ListShot | null {
  const parts = String(cell ?? '')
    .split('>')
    .map((p) => safeName(p));
  const name = parts.pop() ?? '';
  if (!name) return null;
  return { path: parts.filter(Boolean), name };
}

export function sheetToList(sheetName: string, rows: unknown[][]): ParsedList | null {
  const machine = safeName(sheetName);
  const warnings: string[] = [];
  const headerAt = rows.findIndex((r) => r.some((c) => String(c ?? '').trim()));
  if (!machine || headerAt < 0) return null;
  const header = rows[headerAt];
  const width = Math.max(...rows.map((r) => r.length));
  const folders: ListFolder[] = [];
  const seenFolders = new Set<string>();

  for (let col = 0; col < width; col++) {
    const name = safeName(String(header[col] ?? ''));
    const cells = rows.slice(headerAt + 1).map((r) => r[col]).filter((c) => String(c ?? '').trim());
    if (!name) {
      if (cells.length) warnings.push(`Column ${col + 1} has photo names but no heading, so it was left out.`);
      continue;
    }
    if (seenFolders.has(name.toLowerCase())) {
      warnings.push(`Two columns are called "${name}"; only the first was used.`);
      continue;
    }
    seenFolders.add(name.toLowerCase());
    const shots: ListShot[] = [];
    const seen = new Set<string>();
    for (const cell of cells) {
      const shot = parseCell(cell);
      if (!shot) continue;
      const key = shotKey(shot);
      if (seen.has(key)) {
        warnings.push(`${name}: "${[...shot.path, shot.name].join(' > ')}" is listed twice; kept once.`);
        continue;
      }
      seen.add(key);
      shots.push(shot);
    }
    if (shots.length) folders.push({ name, shots });
    else warnings.push(`${name} has no photo names, so it was left out.`);
  }
  return folders.length ? { machine, folders, warnings } : null;
}

export const shotCount = (l: Pick<MasterList, 'folders'>) => l.folders.reduce((a, f) => a + f.shots.length, 0);

const PLACEHOLDER = /\{\s*(fixture|ft)\s*\}/gi;

export const hasFixture = (text: string) => new RegExp(PLACEHOLDER.source, 'i').test(text);

export const usesFixture = (l: Pick<MasterList, 'folders'>) => l.folders.some((f) => f.shots.some((s) => [...s.path, s.name].some(hasFixture)));

/** Fills {fixture} with the FT number. Left as written until an FT number is given. */
export function fillFixture(text: string, ft: string): string {
  const v = safeName(ft);
  return v ? text.replace(PLACEHOLDER, v) : text;
}

/** How a name with {fixture} reads before an FT number is given: "End Effector_[FT]". */
export const showFixture = (text: string) => text.replace(PLACEHOLDER, '[FT]');

/** What uploading a new version of a list changes, counted by folder/subfolder/name. */
export function diffLists(before: Pick<MasterList, 'folders'>, after: Pick<MasterList, 'folders'>) {
  const keys = (l: Pick<MasterList, 'folders'>) => new Set(l.folders.flatMap((f) => f.shots.map((s) => `${f.name.toLowerCase()}/${shotKey(s)}`)));
  const a = keys(before);
  const b = keys(after);
  return { added: [...b].filter((k) => !a.has(k)).length, removed: [...a].filter((k) => !b.has(k)).length };
}
