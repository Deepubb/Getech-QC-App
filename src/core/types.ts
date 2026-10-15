export type ItemResult = 'pending' | 'ok' | 'nok' | 'na';
/** N = optional, Y = always required, M = required only when the result is NOK. */
export type RemarksRule = 'N' | 'Y' | 'M';

export interface TemplateItem {
  itemNo: string;
  category: string;
  procedure: string;
  expected: string;
  remarksRule: RemarksRule;
  failInstruction: string;
}

export interface ChecklistItem extends TemplateItem {
  id: string;
  result: ItemResult;
  remarks: string;
  completedAt: string | null;
}

export type ChecklistStatus = 'in_progress' | 'completed';

export interface MachineInfo {
  machineName: string;
  machineCode: string;
  customer: string;
  cwo: string;
}

interface SyncFields {
  id: string;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
}

export interface Checklist extends MachineInfo, SyncFields {
  engineer: string;
  status: ChecklistStatus;
  exportedAt: string | null;
  items: ChecklistItem[];
}

export interface Template extends SyncFields {
  machineCode: string;
  machineName: string;
  customer: string;
  version: string;
  items: TemplateItem[];
}

/** One photo. Its file name in the zip is exactly `name` + ".jpg". */
export interface EvidencePhoto {
  id: string;
  name: string;
  takenAt: string;
  bytes: number;
}

/** A folder in the zip, e.g. "Safety". `planned` are names expected for this machine (from a photo template). */
export interface EvidenceCategory {
  id: string;
  name: string;
  planned: string[];
  photos: EvidencePhoto[];
}

/** Photo evidence for one machine, grouped into categories. */
export interface EvidenceSet extends SyncFields {
  title: string;
  machineCode: string;
  cwo: string;
  customer: string;
  engineer: string;
  exportedAt: string | null;
  categories: EvidenceCategory[];
}

/** Categories and photo names saved per machine code, used to pre-fill the next set. */
export interface PhotoTemplate extends SyncFields {
  machineCode: string;
  categories: { name: string; names: string[] }[];
}

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  engineerName: string;
  defaultCategories: string[];
  splitMB: number;
  theme: ThemeChoice;
  deviceId: string;
}

export interface StoredPhoto {
  full: Blob;
  thumb: Blob;
}
