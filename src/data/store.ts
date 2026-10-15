import { create } from 'zustand';
import { processImage } from '../camera/processImage';
import { DEFAULT_CATEGORIES, safeName } from '../core/evidence';
import { uid, nowISO } from '../core/ids';
import type {
  Checklist,
  ChecklistItem,
  EvidenceCategory,
  EvidencePhoto,
  EvidenceSet,
  MachineInfo,
  PhotoTemplate,
  Settings,
  Template,
  TemplateItem,
} from '../core/types';
import { deleteDoc, deletePhotos, getMeta, loadAll, putDoc, putPhoto, saveSettingsDoc, setMeta, wipeDatabase } from './db';

export interface ChecklistDraft {
  source: 'template' | 'excel' | 'blank';
  machine: MachineInfo;
  items: TemplateItem[];
  photoPlan: { name: string; names: string[] }[];
  fileName?: string;
  errors: string[];
  warnings: string[];
  categoryCount: number;
}

export type CategoryPlan = { name: string; names: string[] }[];

interface AppState {
  ready: boolean;
  storageError: string | null;
  settings: Settings;
  checklists: Checklist[];
  templates: Template[];
  evidence: EvidenceSet[];
  photoTemplates: PhotoTemplate[];
  draft: ChecklistDraft | null;

  init(): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  setDraft(d: ChecklistDraft | null): void;

  createChecklist(machine: MachineInfo, items: TemplateItem[], engineer: string): Promise<string>;
  updateChecklist(id: string, change: (c: Checklist) => void, opts?: { touch?: boolean }): Promise<void>;
  deleteChecklist(id: string): Promise<void>;
  saveTemplateFrom(checklistId: string, version?: string): Promise<'created' | 'replaced'>;
  deleteTemplate(id: string): Promise<void>;

  createEvidence(info: Pick<EvidenceSet, 'title' | 'machineCode' | 'cwo' | 'customer'>, plan: CategoryPlan): Promise<string>;
  updateEvidence(id: string, change: (e: EvidenceSet) => void, opts?: { touch?: boolean }): Promise<void>;
  deleteEvidence(id: string): Promise<void>;
  addCategory(evidenceId: string, name: string): Promise<string>;
  deleteCategory(evidenceId: string, categoryId: string): Promise<void>;
  /** Stores the photo straight away so it can never be lost, then returns its id for naming. */
  addPhoto(evidenceId: string, categoryId: string, file: File, name?: string): Promise<string>;
  deletePhoto(evidenceId: string, categoryId: string, photoId: string): Promise<void>;
  savePhotoTemplate(machineCode: string, plan: CategoryPlan): Promise<'created' | 'replaced'>;
  deletePhotoTemplate(id: string): Promise<void>;
  wipeAll(): Promise<void>;
}

const defaultSettings = (): Settings => ({
  engineerName: '',
  defaultCategories: DEFAULT_CATEGORIES.slice(0, 4),
  splitMB: 90,
  theme: 'system',
  deviceId: uid(),
});

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
const mkCategory = (name: string, planned: string[] = []): EvidenceCategory => ({ id: uid(), name: safeName(name), planned, photos: [] });

/** Version 1 stored evidence as a flat list of "shots"; fold those into one category. */
function migrateEvidence(e: EvidenceSet & { shots?: { name: string; photos: { id: string; takenAt: string; bytes: number }[] }[] }): EvidenceSet | null {
  if (e.categories) return null;
  const photos: EvidencePhoto[] = [];
  for (const s of e.shots ?? []) s.photos.forEach((p, i) => photos.push({ ...p, name: s.name ? (i ? `${s.name} ${i + 1}` : s.name) : '' }));
  const { shots: _drop, ...rest } = e;
  void _drop;
  return { ...rest, categories: [{ ...mkCategory('General'), photos }] };
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  storageError: null,
  settings: defaultSettings(),
  checklists: [],
  templates: [],
  evidence: [],
  photoTemplates: [],
  draft: null,

  async init() {
    try {
      const data = await loadAll();
      const settings = { ...defaultSettings(), ...(data.settings ?? {}) };
      if (!data.settings || !data.settings.defaultCategories) await saveSettingsDoc(settings);
      const evidence = await Promise.all(
        data.evidence.map(async (e) => {
          const migrated = migrateEvidence(e);
          if (migrated) await putDoc('evidence', migrated);
          return migrated ?? e;
        }),
      );
      set({ ...data, evidence, settings, ready: true });
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
    const c = stamp<Checklist>(get().settings.deviceId, { ...machine, engineer, status: 'in_progress', exportedAt: null, items: items.map(toItem) });
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

  async createEvidence(info, plan) {
    const e = stamp<EvidenceSet>(get().settings.deviceId, {
      ...info,
      engineer: get().settings.engineerName,
      exportedAt: null,
      categories: plan.filter((p) => safeName(p.name)).map((p) => mkCategory(p.name, p.names.map(safeName).filter(Boolean))),
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
    if (e) await deletePhotos(e.categories.flatMap((c) => c.photos.map((p) => p.id)));
  },

  async addCategory(evidenceId, name) {
    const c = mkCategory(name);
    await get().updateEvidence(evidenceId, (e) => void e.categories.push(c));
    return c.id;
  },

  async deleteCategory(evidenceId, categoryId) {
    const cat = get().evidence.find((x) => x.id === evidenceId)?.categories.find((c) => c.id === categoryId);
    await get().updateEvidence(evidenceId, (e) => void (e.categories = e.categories.filter((c) => c.id !== categoryId)));
    if (cat) await deletePhotos(cat.photos.map((p) => p.id));
  },

  async addPhoto(evidenceId, categoryId, file, name = '') {
    const stored = await processImage(file);
    const photo: EvidencePhoto = { id: uid(), name: safeName(name), takenAt: nowISO(), bytes: stored.full.size };
    await putPhoto(photo.id, stored);
    await get().updateEvidence(evidenceId, (e) => {
      const cat = e.categories.find((c) => c.id === categoryId);
      if (cat) cat.photos.push(photo);
    });
    return photo.id;
  },

  async deletePhoto(evidenceId, categoryId, photoId) {
    await get().updateEvidence(evidenceId, (e) => {
      const cat = e.categories.find((c) => c.id === categoryId);
      if (cat) cat.photos = cat.photos.filter((p) => p.id !== photoId);
    });
    await deletePhotos([photoId]);
  },

  async savePhotoTemplate(machineCode, plan) {
    const categories = plan
      .map((c) => ({ name: safeName(c.name), names: [...new Set(c.names.map(safeName).filter(Boolean))] }))
      .filter((c) => c.name);
    const existing = get().photoTemplates.find((l) => sameCode(l.machineCode, machineCode));
    const t: PhotoTemplate = existing
      ? { ...existing, categories, updatedAt: nowISO() }
      : stamp<PhotoTemplate>(get().settings.deviceId, { machineCode: machineCode.trim(), categories });
    set({ photoTemplates: existing ? get().photoTemplates.map((x) => (x.id === t.id ? t : x)) : [...get().photoTemplates, t] });
    await putDoc('photoTemplates', t);
    return existing ? 'replaced' : 'created';
  },

  async deletePhotoTemplate(id) {
    set({ photoTemplates: get().photoTemplates.filter((l) => l.id !== id) });
    await deleteDoc('photoTemplates', id);
  },

  async wipeAll() {
    const keep = { engineerName: get().settings.engineerName, defaultCategories: get().settings.defaultCategories };
    await wipeDatabase();
    const settings = { ...defaultSettings(), ...keep };
    await saveSettingsDoc(settings);
    set({ checklists: [], templates: [], evidence: [], photoTemplates: [], draft: null, settings });
  },
}));

export const findPhotoTemplate = (list: PhotoTemplate[], code: string) => list.find((l) => code.trim() && sameCode(l.machineCode, code));
export const findTemplate = (templates: Template[], code: string) => templates.find((t) => code.trim() && sameCode(t.machineCode, code));
/** The plan a set would be saved as: its categories and the photo names in each. */
export const planOf = (e: EvidenceSet): CategoryPlan =>
  e.categories.map((c) => ({ name: c.name, names: [...new Set([...c.photos.map((p) => p.name), ...c.planned].map(safeName).filter(Boolean))] }));
