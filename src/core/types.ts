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

export interface PhotoRef {
  id: string;
  takenAt: string;
  bytes: number;
}

export interface Shot {
  id: string;
  name: string;
  photos: PhotoRef[];
}

export interface EvidenceSet extends SyncFields {
  title: string;
  machineCode: string;
  cwo: string;
  customer: string;
  engineer: string;
  exportedAt: string | null;
  shots: Shot[];
}

/** Photo names saved per machine code, used to pre-fill new evidence sets. */
export interface ShotList extends SyncFields {
  machineCode: string;
  names: string[];
}

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  engineerName: string;
  splitMB: number;
  theme: ThemeChoice;
  deviceId: string;
}

export interface StoredPhoto {
  full: Blob;
  thumb: Blob;
}
