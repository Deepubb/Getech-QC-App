import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Checklist, EvidenceSet, PhotoTemplate, Settings, StoredPhoto, Template } from '../core/types';

interface QcDB extends DBSchema {
  checklists: { key: string; value: Checklist };
  templates: { key: string; value: Template };
  evidence: { key: string; value: EvidenceSet };
  photoTemplates: { key: string; value: PhotoTemplate };
  photos: { key: string; value: StoredPhoto };
  meta: { key: string; value: unknown };
}

export type DocStore = 'checklists' | 'templates' | 'evidence' | 'photoTemplates';

const DB_NAME = 'getech-qc';
const DB_VERSION = 2;
let dbPromise: Promise<IDBPDatabase<QcDB>> | null = null;

/** Every read and write goes through this module, so sync or encryption can be added later in one place. */
export function db(): Promise<IDBPDatabase<QcDB>> {
  dbPromise ??= openDB<QcDB>(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('checklists', { keyPath: 'id' });
        d.createObjectStore('templates', { keyPath: 'id' });
        d.createObjectStore('evidence', { keyPath: 'id' });
        d.createObjectStore('photos');
        d.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        // Version 1 kept flat "shot lists"; version 2 keeps photo templates grouped by category.
        const names = d.objectStoreNames as DOMStringList;
        if (names.contains('shotlists')) (d as unknown as IDBDatabase).deleteObjectStore('shotlists');
        d.createObjectStore('photoTemplates', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

export async function loadAll() {
  const d = await db();
  const [checklists, templates, evidence, photoTemplates, settings] = await Promise.all([
    d.getAll('checklists'),
    d.getAll('templates'),
    d.getAll('evidence'),
    d.getAll('photoTemplates'),
    d.get('meta', 'settings') as Promise<Settings | undefined>,
  ]);
  return { checklists, templates, evidence, photoTemplates, settings };
}

export async function putDoc<S extends DocStore>(store: S, value: QcDB[S]['value']): Promise<void> {
  await (await db()).put(store, value);
}

export async function deleteDoc(store: DocStore, id: string): Promise<void> {
  await (await db()).delete(store, id);
}

export async function saveSettingsDoc(s: Settings): Promise<void> {
  await (await db()).put('meta', s, 'settings');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', value, key);
}

export async function getPhoto(id: string): Promise<StoredPhoto | null> {
  return (await (await db()).get('photos', id)) ?? null;
}

export async function putPhoto(id: string, photo: StoredPhoto): Promise<void> {
  await (await db()).put('photos', photo, id);
}

export async function deletePhotos(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const tx = (await db()).transaction('photos', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function wipeDatabase(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['checklists', 'templates', 'evidence', 'photoTemplates', 'photos', 'meta'], 'readwrite');
  await Promise.all([...tx.objectStoreNames].map((n) => tx.objectStore(n).clear()));
  await tx.done;
}
