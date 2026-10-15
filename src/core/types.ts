interface SyncFields {
  id: string;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
}

/**
 * One photo a master list asks for. A cell "EPSON > Loader Robot" gives path ["EPSON"] and
 * name "Loader Robot"; a cell without ">" has an empty path. The name may hold {fixture}.
 */
export interface ListShot {
  path: string[];
  name: string;
}

/** One column of the master sheet: the column heading is the main folder in the zip. */
export interface ListFolder {
  name: string;
  shots: ListShot[];
}

/** A machine's master list, read from one sheet of the uploaded Excel. The sheet name is the machine name. */
export interface MasterList extends SyncFields {
  machine: string;
  folders: ListFolder[];
  /** The Excel file it came from, shown in Settings. */
  source: string;
}

export interface EvidencePhoto {
  id: string;
  takenAt: string;
  bytes: number;
}

/**
 * One photo name from the list (or added on site when `extra`). Its photos are saved as
 * "<name>.jpg", then "<name>_2.jpg", "<name>_3.jpg".
 */
export interface EvidenceItem {
  id: string;
  path: string[];
  /** As written in the list; {fixture} is filled in from the FT number when files are named. */
  name: string;
  extra: boolean;
  na: boolean;
  photos: EvidencePhoto[];
}

export interface EvidenceFolder {
  id: string;
  name: string;
  items: EvidenceItem[];
}

/** Photo evidence for one machine, copied from its master list when started. */
export interface EvidenceSet extends SyncFields {
  /** The master list (sheet) name, e.g. SSDLV. */
  machine: string;
  /** FT number of this machine; fills {fixture} in photo names. */
  ft: string;
  engineer: string;
  exportedAt: string | null;
  folders: EvidenceFolder[];
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
