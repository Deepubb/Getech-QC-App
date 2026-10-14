import { create } from 'zustand';
import { processImage } from '../camera/processImage';
import { uid, nowISO } from '../core/ids';
import { cleanName } from '../core/names';
import type {
  Checklist,
  ChecklistItem,
  EvidenceSet,
  MachineInfo,
  PhotoRef,
  Settings,
  ShotList,
  Template,
  TemplateItem,
} from '../core/types';
import { deleteDoc, deletePhotos, getMeta, loadAll, putDoc, putPhoto, saveSettingsDoc, setMeta, wipeDatabase } from './db';

export interface ChecklistDraft {
  source: 'template' | 'excel' | 'blank';
  machine: MachineInfo;
  items: TemplateItem[];
  photoNames: string[];
  fileName?: string;
  errors: string[];
  warnings: string[];
  categoryCount: number;
}

interface AppState {
  ready: boolean;
  storageError: string | null;
  settings: Settings;
  checklists: Checklist[];
  templates: Template[];
  evidence: EvidenceSet[];
  shotlists: ShotList[];
  draft: ChecklistDraft | null;

  init(): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  setDraft(d: ChecklistDraft | null): void;

  createChecklist(machine: MachineInfo, items: TemplateItem[], engineer: string): Promise<string>;
  updateChecklist(id: string, change: (c: Checklist) => void, opts?: { touch?: boolean }): Promise<void>;
  deleteChecklist(id: string): Promise<void>;
  saveTemplateFrom(checklistId: string, version?: string): Promise<'created' | 'replaced'>;
  deleteTemplate(id: string): Promise<void>;

  createEvidence(info: Pick<EvidenceSet, 'title' | 'machineCode' | 'cwo' | 'customer'>, names: string[]): Promise<string>;
  updateEvidence(id: string, change: (e: EvidenceSet) => void, opts?: { touch?: boolean }): Promise<void>;
  deleteEvidence(id: string): Promise<void>;
  addPhotos(evidenceId: string, shotId: string | null, files: File[]): Promise<{ added: number; failed: number }>;
  deletePhoto(evidenceId: string, shotId: string, photoId: string): Promise<void>;
  deleteShot(evidenceId: string, shotId: string): Promise<void>;
  saveShotList(machineCode: string, names: string[]): Promise<'created' | 'replaced'>;
  deleteShotList(id: string): Promise<void>;
  wipeAll(): Promise<void>;
}

const defaultSettings = (): Settings => ({ engineerName: '', splitMB: 90, theme: 'system', deviceId: uid() });

function stamp<T extends { createdAt: string; updatedAt: string; deviceId: string; id: string }>(
  deviceId: string,
  body: Omit<T, 'createdAt' | 'updatedAt' | 'deviceId' | 'id'>,
): T {
  const t = nowISO();
  return { ...(body as object), id: uid(), createdAt: t, updatedAt: t, deviceId } as T;
}

const toItem = (t: TemplateItem): ChecklistItem => ({ ...t, id: uid(), result: 'pending', remarks: '', completedAt: null });
const toTemplateItem = (i: ChecklistItem): TemplateItem => ({
  itemNo: i.itemNo,
  category: i.category,
  procedure: i.procedure,
  expected: i.expected,
  remarksRule: i.remarksRule,
  failInstruction: i.failInstruction,
});
const sameCode = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  storageError: null,
  settings: defaultSettings(),
  checklists: [],
  templates: [],
  evidence: [],
  shotlists: [],
  draft: null,

  async init() {
    try {
      const data = await loadAll();
      const settings = { ...defaultSettings(), ...(data.settings ?? {}) };
      if (!data.settings) await saveSettingsDoc(settings);
      set({ ...data, settings, ready: true });
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

  setDraft(draft) {
    set({ draft });
  },

  async createChecklist(machine, items, engineer) {
    const c = stamp<Checklist>(get().settings.deviceId, {
      ...machine,
      engineer,
      status: 'in_progress',
      exportedAt: null,
      items: items.map(toItem),
    });
    set({ checklists: [...get().checklists, c] });
    await putDoc('checklists', c);
    return c.id;
  },

  async updateChecklist(id, change, opts = { touch: true }) {
    const current = get().checklists.find((c) => c.id === id);
    if (!current) return;
    const next = structuredClone(current);
    change(next);
    if (opts.touch !== false) next.updatedAt = nowISO();
    set({ checklists: get().checklists.map((c) => (c.id === id ? next : c)) });
    await putDoc('checklists', next);
  },

  async deleteChecklist(id) {
    set({ checklists: get().checklists.filter((c) => c.id !== id) });
    await deleteDoc('checklists', id);
  },

  async saveTemplateFrom(checklistId, version = '') {
    const c = get().checklists.find((x) => x.id === checklistId);
    if (!c) throw new Error('Checklist not found.');
    const existing = get().templates.find((t) => sameCode(t.machineCode, c.machineCode));
    const body = { machineCode: c.machineCode, machineName: c.machineName, customer: c.customer, version, items: c.items.map(toTemplateItem) };
    const t: Template = existing
      ? { ...existing, ...body, version: version || existing.version, updatedAt: nowISO() }
      : stamp<Template>(get().settings.deviceId, body);
    set({ templates: existing ? get().templates.map((x) => (x.id === t.id ? t : x)) : [...get().templates, t] });
    await putDoc('templates', t);
    return existing ? 'replaced' : 'created';
  },

  async deleteTemplate(id) {
    set({ templates: get().templates.filter((t) => t.id !== id) });
    await deleteDoc('templates', id);
  },

  async createEvidence(info, names) {
    const e = stamp<EvidenceSet>(get().settings.deviceId, {
      ...info,
      engineer: get().settings.engineerName,
      exportedAt: null,
      shots: names.map((name) => ({ id: uid(), name, photos: [] })),
    });
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
    if (e) await deletePhotos(e.shots.flatMap((s) => s.photos.map((p) => p.id)));
  },

  async addPhotos(evidenceId, shotId, files) {
    let added = 0;
    let failed = 0;
    for (const file of files) {
      try {
        const stored = await processImage(file);
        const ref: PhotoRef = { id: uid(), takenAt: nowISO(), bytes: stored.full.size };
        await putPhoto(ref.id, stored);
        await get().updateEvidence(evidenceId, (e) => {
          const shot = shotId ? e.shots.find((s) => s.id === shotId) : null;
          if (shot) shot.photos.push(ref);
          else e.shots.push({ id: uid(), name: '', photos: [ref] });
        });
        added++;
      } catch {
        failed++;
      }
    }
    return { added, failed };
  },

  async deletePhoto(evidenceId, shotId, photoId) {
    await get().updateEvidence(evidenceId, (e) => {
      const shot = e.shots.find((s) => s.id === shotId);
      if (shot) shot.photos = shot.photos.filter((p) => p.id !== photoId);
    });
    await deletePhotos([photoId]);
  },

  async deleteShot(evidenceId, shotId) {
    const e = get().evidence.find((x) => x.id === evidenceId);
    const shot = e?.shots.find((s) => s.id === shotId);
    await get().updateEvidence(evidenceId, (ev) => {
      ev.shots = ev.shots.filter((s) => s.id !== shotId);
    });
    if (shot) await deletePhotos(shot.photos.map((p) => p.id));
  },

  async saveShotList(machineCode, names) {
    const clean = [...new Set(names.map(cleanName).filter(Boolean))];
    const existing = get().shotlists.find((l) => sameCode(l.machineCode, machineCode));
    const l: ShotList = existing
      ? { ...existing, names: clean, updatedAt: nowISO() }
      : stamp<ShotList>(get().settings.deviceId, { machineCode: machineCode.trim(), names: clean });
    set({ shotlists: existing ? get().shotlists.map((x) => (x.id === l.id ? l : x)) : [...get().shotlists, l] });
    await putDoc('shotlists', l);
    return existing ? 'replaced' : 'created';
  },

  async deleteShotList(id) {
    set({ shotlists: get().shotlists.filter((l) => l.id !== id) });
    await deleteDoc('shotlists', id);
  },

  async wipeAll() {
    const keep = { engineerName: get().settings.engineerName };
    await wipeDatabase();
    const settings = { ...defaultSettings(), ...keep };
    await saveSettingsDoc(settings);
    set({ checklists: [], templates: [], evidence: [], shotlists: [], draft: null, settings });
  },
}));

export const findShotList = (lists: ShotList[], code: string) => lists.find((l) => code.trim() && sameCode(l.machineCode, code));
export const findTemplate = (templates: Template[], code: string) => templates.find((t) => code.trim() && sameCode(t.machineCode, code));
