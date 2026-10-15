import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EvidenceSet, MasterList, Settings, StoredPhoto } from '../core/types';

interface QcDB extends DBSchema {
  evidence: { key: string; value: EvidenceSet };
  masterLists: { key: string; value: MasterList };
  photos: { key: string; value: StoredPhoto };
  meta: { key: string; value: unknown };
}

export type DocStore = 'evidence' | 'masterLists';

const DB_NAME = 'getech-qc';
const DB_VERSION = 3;
let dbPromise: Promise<IDBPDatabase<QcDB>> | null = null;

/** Every read and write goes through this module, so sync or encryption can be added later in one place. */
export function db(): Promise<IDBPDatabase<QcDB>> {
  dbPromise ??= openDB<QcDB>(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('evidence', { keyPath: 'id' });
        d.createObjectStore('photos');
        d.createObjectStore('meta');
      }
      if (oldVersion < 3) {
        // Version 3 is photo evidence only: checklists, their templates and the old photo
        // templates are gone; photo names now come from uploaded master lists.
        const raw = d as unknown as IDBDatabase;
        for (const old of ['checklists', 'templates', 'shotlists', 'photoTemplates']) {
          if (raw.objectStoreNames.contains(old)) raw.deleteObjectStore(old);
        }
        d.createObjectStore('masterLists', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

export async function loadAll() {
  const d = await db();
  const [evidence, masterLists, settings] = await Promise.all([
    d.getAll('evidence'),
    d.getAll('masterLists'),
    d.get('meta', 'settings') as Promise<Settings | undefined>,
  ]);
  return { evidence, masterLists, settings };
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

/** Deletes all photo evidence and settings; machine lists are kept. */
export async function wipeDatabase(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['evidence', 'photos', 'meta'], 'readwrite');
  await Promise.all([...tx.objectStoreNames].map((n) => tx.objectStore(n).clear()));
  await tx.done;
}
