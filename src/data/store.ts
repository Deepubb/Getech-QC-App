import { create } from 'zustand';
import { processImage } from '../camera/processImage';
import { needsFt, safeName } from '../core/evidence';
import { uid, nowISO } from '../core/ids';
import { diffLists, type ParsedList } from '../core/masterList';
import { plural } from '../core/format';
import { rebaseOnList } from '../core/rebase';
import type { EvidenceFolder, EvidenceItem, EvidencePhoto, EvidenceSet, MasterList, Settings, TeamInfo } from '../core/types';
import { deleteDoc, deletePhotos, getMeta, loadAll, putDoc, putPhoto, saveSettingsDoc, setMeta, wipeDatabase } from './db';
import { fetchTeamMaster, publishTeamMaster, type PublishError } from './remote';

interface AppState {
  ready: boolean;
  storageError: string | null;
  settings: Settings;
  evidence: EvidenceSet[];
  masterLists: MasterList[];
  /** The team master list this phone last downloaded. */
  team: TeamInfo | null;

  init(): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;

  /** Adds new machines and replaces lists of machines already known (matched by name). */
  saveMasterLists(lists: ParsedList[], source: string): Promise<void>;
  deleteMasterList(id: string): Promise<void>;
  /** Downloads the team master list if it changed. Returns a line for the engineer, or null when nothing changed. */
  syncTeam(): Promise<string | null>;
  publishTeam(lists: ParsedList[], source: string): Promise<{ ok: true; message: string } | { ok: false; error: PublishError; missing?: string[] }>;
  /** Moves a machine in progress onto the current master list for its machine. */
  applyList(evidenceId: string): Promise<void>;
  dismissList(evidenceId: string, hash: string): Promise<void>;

  createEvidence(listId: string, number: string): Promise<string>;
  updateEvidence(id: string, change: (e: EvidenceSet) => void, opts?: { touch?: boolean }): Promise<void>;
  deleteEvidence(id: string): Promise<void>;
  /** Stores the photo straight away so it can never be lost. With `replaceId`, it takes that photo's place (and FT number). */
  addPhoto(evidenceId: string, itemId: string, file: Blob, replaceId?: string): Promise<string>;
  setPhotoFt(evidenceId: string, itemId: string, photoId: string, ft: string): Promise<void>;
  deletePhoto(evidenceId: string, itemId: string, photoId: string): Promise<void>;
  addExtraItem(evidenceId: string, folderId: string, path: string[], name: string): Promise<string>;
  deleteItem(evidenceId: string, itemId: string): Promise<void>;
  wipeAll(): Promise<void>;
}

const defaultSettings = (): Settings => ({
  engineerName: '',
  splitMB: 90,
  theme: 'system',
  deviceId: uid(),
});

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const findItem = (e: EvidenceSet, itemId: string) => e.folders.flatMap((f) => f.items).find((i) => i.id === itemId);

/**
 * Before version 3, photo evidence had free categories with a typed name per photo.
 * Each category becomes a folder and each name an extra item, so nothing taken is lost.
 */
type OldSet = Omit<EvidenceSet, 'folders' | 'machine' | 'number'> & {
  title?: string;
  machineCode?: string;
  categories?: { name: string; photos: (EvidencePhoto & { name: string })[] }[];
};
function migrateEvidence(raw: EvidenceSet | OldSet): EvidenceSet | null {
  if ('folders' in raw && raw.folders) return null;
  const old = raw as OldSet;
  const folders: EvidenceFolder[] = (old.categories ?? []).map((c) => {
    const items: EvidenceItem[] = [];
    c.photos.forEach((p, n) => {
      const name = safeName(p.name) || `Photo ${n + 1}`;
      const same = items.find((i) => sameName(i.name, name));
      const photo = { id: p.id, takenAt: p.takenAt, bytes: p.bytes };
      if (same) same.photos.push(photo);
      else items.push({ id: uid(), path: [], name, extra: true, na: false, photos: [photo] });
    });
    return { id: uid(), name: safeName(c.name) || 'General', items };
  });
  const { title, machineCode, categories: _drop, ...rest } = old;
  void _drop;
  return { ...rest, machine: safeName(title) || safeName(machineCode) || 'Machine', number: safeName(machineCode) || safeName(title), folders };
}

/**
 * Earlier builds of version 3 had one "FT number" per machine. It identified the machine, so it
 * becomes the machine number, and photos that used it for {fixture} keep it as their own FT number.
 */
function migrateFt(e: EvidenceSet & { ft?: string }): EvidenceSet | null {
  if (typeof e.number === 'string') return null;
  const { ft = '', ...rest } = e;
  const folders = rest.folders.map((f) => ({
    ...f,
    items: f.items.map((i) => (needsFt(i) ? { ...i, photos: i.photos.map((p) => ({ ...p, ft: p.ft ?? ft })) } : i)),
  }));
  return { ...rest, number: ft || rest.machine, folders };
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  storageError: null,
  settings: defaultSettings(),
  evidence: [],
  masterLists: [],
  team: null,

  async init() {
    try {
      const data = await loadAll();
      const settings = { ...defaultSettings(), ...(data.settings ?? {}) };
      if (!data.settings) await saveSettingsDoc(settings);
      const evidence = await Promise.all(
        (data.evidence as (EvidenceSet | OldSet)[]).map(async (e) => {
          const current = migrateEvidence(e) ?? (e as EvidenceSet);
          const migrated = migrateFt(current);
          if (migrated || current !== e) await putDoc('evidence', migrated ?? current);
          return migrated ?? current;
        }),
      );
      const team = (await getMeta<TeamInfo>('team')) ?? null;
      set({ evidence, masterLists: data.masterLists, settings, team, ready: true });
      // Ask once for persistent storage so the browser does not evict inspections.
      if (!(await getMeta<boolean>('persistAsked')) && navigator.storage?.persist) {
        await setMeta('persistAsked', true);
        navigator.storage.persist().catch(() => undefined);
      }
    } catch (err) {
      set({ ready: true, storageError: err instanceof Error ? err.message : String(err) });
    }
  },

  async saveSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await saveSettingsDoc(settings);
  },

  async saveMasterLists(lists, source) {
    let all = [...get().masterLists];
    for (const l of lists) {
      const existing = all.find((x) => sameName(x.machine, l.machine));
      const t = nowISO();
      const next: MasterList = existing
        ? { ...existing, machine: l.machine, folders: l.folders, source, updatedAt: t }
        : { id: uid(), createdAt: t, updatedAt: t, deviceId: get().settings.deviceId, machine: l.machine, folders: l.folders, source };
      all = existing ? all.map((x) => (x.id === next.id ? next : x)) : [...all, next];
      await putDoc('masterLists', next);
    }
    set({ masterLists: all });
  },

  async deleteMasterList(id) {
    set({ masterLists: get().masterLists.filter((l) => l.id !== id) });
    await deleteDoc('masterLists', id);
  },

  async syncTeam() {
    const remote = await fetchTeamMaster();
    const known = get().team;
    if (!remote || remote.version === known?.version) return null;
    const before = get().masterLists;
    // The team list is the source of truth: machines missing from it are removed from the phone.
    const gone = before.filter((l) => !remote.lists.some((r) => sameName(r.machine, l.machine)));
    for (const l of gone) await deleteDoc('masterLists', l.id);
    set({ masterLists: before.filter((l) => !gone.includes(l)) });
    await get().saveMasterLists(
      remote.lists.map((l) => ({ ...l, warnings: [] })),
      remote.source,
    );
    const { version, publishedAt, publishedBy, source } = remote;
    const team = { version, publishedAt, publishedBy, source };
    await setMeta('team', team);
    set({ team });
    if (!known) return `Master list downloaded: ${plural(remote.lists.length, 'machine')}.`;
    const changes = remote.lists
      .map((l) => {
        const old = before.find((b) => sameName(b.machine, l.machine));
        if (!old) return `${l.machine} new`;
        const d = diffLists(old, l);
        return d.added || d.removed ? `${l.machine} +${d.added} −${d.removed}` : '';
      })
      .concat(gone.map((l) => `${l.machine} removed`))
      .filter(Boolean);
    return changes.length ? `Master list updated: ${changes.join(', ')}` : null;
  },

  async publishTeam(lists, source) {
    const r = await publishTeamMaster(lists, source, get().settings.engineerName);
    if (!r.ok) return r;
    await get().syncTeam();
    return { ok: true, message: `Published to the team: ${plural(lists.length, 'machine')}.` };
  },

  async applyList(evidenceId) {
    const e = get().evidence.find((x) => x.id === evidenceId);
    const list = e && get().masterLists.find((l) => sameName(l.machine, e.machine));
    if (!e || !list) return;
    const r = rebaseOnList(e.folders, list.folders);
    await get().updateEvidence(evidenceId, (d) => {
      d.folders = r.folders;
      delete d.dismissedList;
    });
  },

  async dismissList(evidenceId, hash) {
    await get().updateEvidence(evidenceId, (d) => void (d.dismissedList = hash), { touch: false });
  },

  async createEvidence(listId, number) {
    const list = get().masterLists.find((l) => l.id === listId);
    if (!list) throw new Error('That machine list is no longer on this phone.');
    const t = nowISO();
    // The list is copied in, so a newer upload never changes photo evidence already started.
    const e: EvidenceSet = {
      id: uid(),
      createdAt: t,
      updatedAt: t,
      deviceId: get().settings.deviceId,
      machine: list.machine,
      number: safeName(number),
      engineer: get().settings.engineerName,
      exportedAt: null,
      folders: list.folders.map((f) => ({
        id: uid(),
        name: f.name,
        items: f.shots.map((s) => ({ id: uid(), path: s.path, name: s.name, extra: false, na: false, photos: [] })),
      })),
    };
    set({ evidence: [...get().evidence, e] });
    await putDoc('evidence', e);
    return e.id;
  },

  async updateEvidence(id, change, opts = { touch: true }) {
    const current = get().evidence.find((e) => e.id === id);
    if (!current) return;
    const next = structuredClone(current);
    change(next);
    if (opts.touch !== false) next.updatedAt = nowISO();
    set({ evidence: get().evidence.map((e) => (e.id === id ? next : e)) });
    await putDoc('evidence', next);
  },

  async deleteEvidence(id) {
    const e = get().evidence.find((x) => x.id === id);
    set({ evidence: get().evidence.filter((x) => x.id !== id) });
    await deleteDoc('evidence', id);
    if (e) await deletePhotos(e.folders.flatMap((f) => f.items.flatMap((i) => i.photos.map((p) => p.id))));
  },

  async addPhoto(evidenceId, itemId, file, replaceId) {
    const stored = await processImage(file);
    const photo: EvidencePhoto = { id: uid(), takenAt: nowISO(), bytes: stored.full.size };
    await putPhoto(photo.id, stored);
    await get().updateEvidence(evidenceId, (e) => {
      const item = findItem(e, itemId);
      if (!item) return;
      const at = replaceId ? item.photos.findIndex((p) => p.id === replaceId) : -1;
      if (at >= 0) item.photos[at] = { ...photo, ...(item.photos[at].ft ? { ft: item.photos[at].ft } : {}) };
      else item.photos.push(photo);
      item.na = false;
    });
    if (replaceId) await deletePhotos([replaceId]);
    return photo.id;
  },

  async setPhotoFt(evidenceId, itemId, photoId, ft) {
    await get().updateEvidence(evidenceId, (e) => {
      const p = findItem(e, itemId)?.photos.find((x) => x.id === photoId);
      if (p) p.ft = safeName(ft);
    });
  },

  async deletePhoto(evidenceId, itemId, photoId) {
    await get().updateEvidence(evidenceId, (e) => {
      const item = findItem(e, itemId);
      if (item) item.photos = item.photos.filter((p) => p.id !== photoId);
    });
    await deletePhotos([photoId]);
  },

  async addExtraItem(evidenceId, folderId, path, name) {
    const item: EvidenceItem = { id: uid(), path, name, extra: true, na: false, photos: [] };
    await get().updateEvidence(evidenceId, (e) => void e.folders.find((f) => f.id === folderId)?.items.push(item));
    return item.id;
  },

  async deleteItem(evidenceId, itemId) {
    const e = get().evidence.find((x) => x.id === evidenceId);
    const item = e && findItem(e, itemId);
    await get().updateEvidence(evidenceId, (d) => {
      for (const f of d.folders) f.items = f.items.filter((i) => i.id !== itemId);
    });
    if (item) await deletePhotos(item.photos.map((p) => p.id));
  },

  async wipeAll() {
    const keep = { engineerName: get().settings.engineerName };
    await wipeDatabase();
    const settings = { ...defaultSettings(), ...keep };
    await saveSettingsDoc(settings);
    if (get().team) await setMeta('team', get().team);
    // Machine lists are set-up, not work, so they stay.
    set({ evidence: [], settings });
  },
}));
