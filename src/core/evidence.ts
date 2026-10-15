import type { EvidenceCategory, EvidencePhoto, EvidenceSet } from './types';

export const DEFAULT_CATEGORIES = ['Safety', 'Functional', 'Mechanical', 'Electrical', 'Software & GUI', 'Customer Request'];

/**
 * Makes a typed name safe as a file or folder name while changing as little as possible:
 * removes characters Windows, macOS and Android refuse (\ / : * ? " < > | and control
 * characters), collapses spaces, trims spaces and dots at the ends, drops a typed ".jpg".
 * "Belt tension (left)" stays "Belt tension (left)".
 */
export function safeName(input: string | null | undefined): string {
  return String(input ?? '')
    .replace(/\.(jpe?g|png|heic)\s*$/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 120);
}

const key = (s: string) => safeName(s).toLowerCase();

/** Photo names already used in a category (case-insensitive), optionally ignoring one photo. */
export function usedNames(cat: EvidenceCategory, exceptPhotoId?: string): Set<string> {
  return new Set(cat.photos.filter((p) => p.id !== exceptPhotoId && safeName(p.name)).map((p) => key(p.name)));
}

export function nameTaken(cat: EvidenceCategory, name: string, exceptPhotoId?: string): boolean {
  const k = key(name);
  return !!k && usedNames(cat, exceptPhotoId).has(k);
}

/** Planned names not yet taken in this category, in template order. */
export function toTake(cat: EvidenceCategory): string[] {
  const used = usedNames(cat);
  return cat.planned.filter((n) => safeName(n) && !used.has(key(n)));
}

export const categoryTaken = (e: EvidenceSet, name: string, exceptId?: string) =>
  e.categories.some((c) => c.id !== exceptId && key(c.name) === key(name));

export interface ZipEntry {
  path: string;
  category: EvidenceCategory;
  photo: EvidencePhoto;
}

/** Zip paths are exactly "<Category>/<Photo name>.jpg". Empty categories make no folder. */
export function zipEntries(e: EvidenceSet): ZipEntry[] {
  return e.categories.flatMap((category) =>
    category.photos.map((photo) => ({ path: `${safeName(category.name)}/${safeName(photo.name)}.jpg`, category, photo })),
  );
}

export interface EvidenceProblem {
  kind: 'unnamed' | 'duplicate' | 'category';
  message: string;
  categoryId: string;
  photoId?: string;
}

/** Anything that would make a file or folder name empty or collide. Export is blocked until fixed. */
export function evidenceProblems(e: EvidenceSet): EvidenceProblem[] {
  const out: EvidenceProblem[] = [];
  const seenCats = new Map<string, string>();
  for (const c of e.categories) {
    const ck = key(c.name);
    if (!c.photos.length) continue;
    if (!ck) out.push({ kind: 'category', categoryId: c.id, message: 'A category with photos has no name.' });
    else if (seenCats.has(ck)) out.push({ kind: 'category', categoryId: c.id, message: `Two categories are called "${safeName(c.name)}".` });
    else seenCats.set(ck, c.id);
    const seen = new Set<string>();
    for (const p of c.photos) {
      const pk = key(p.name);
      if (!pk) out.push({ kind: 'unnamed', categoryId: c.id, photoId: p.id, message: `A photo in ${safeName(c.name) || 'a category'} has no name.` });
      else if (seen.has(pk)) out.push({ kind: 'duplicate', categoryId: c.id, photoId: p.id, message: `"${safeName(p.name)}" is used twice in ${safeName(c.name)}.` });
      else seen.add(pk);
    }
  }
  return out;
}

export const evidencePhotoCount = (e: EvidenceSet) => e.categories.reduce((a, c) => a + c.photos.length, 0);
export const evidenceBytes = (e: EvidenceSet) => e.categories.reduce((a, c) => a + c.photos.reduce((b, p) => b + p.bytes, 0), 0);

/** Zip file name: the machine name (or code), nothing else. */
export function zipBaseName(e: Pick<EvidenceSet, 'title' | 'machineCode'>): string {
  return safeName(e.title) || safeName(e.machineCode) || 'Photo evidence';
}
