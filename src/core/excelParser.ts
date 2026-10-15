import * as XLSX from 'xlsx';
import { safeName } from './evidence';
import { pad } from './names';
import type { MachineInfo, RemarksRule, TemplateItem } from './types';

/**
 * Reads the same two-sheet workbook the native app imports:
 * a Checklist sheet (Item No, Category, Test Procedure, Expected Value, Photo Required,
 * Photo Filename, Remarks Required, Fail Instruction) and a MachineInfo sheet (label | value rows).
 * Photo columns no longer affect the checklist; photo filenames are offered as a photo template.
 */
export interface ParsedChecklist {
  machine: MachineInfo & { version: string };
  items: TemplateItem[];
  /** Photo file names from the sheet, grouped by the item's category; offered as a photo template. */
  photoPlan: { name: string; names: string[] }[];
  errors: string[];
  warnings: string[];
  categoryCount: number;
}

export function normalizeHeader(h: unknown): string {
  return String(h).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function parseChecklistWorkbook(data: ArrayBuffer | Uint8Array): ParsedChecklist {
  const wb = XLSX.read(data, { type: 'array' });
  if (wb.SheetNames.length < 2) {
    throw new Error('The Excel file needs at least 2 sheets: Checklist and MachineInfo.');
  }
  const find = (...names: string[]) => {
    for (const n of names) {
      const match = wb.SheetNames.find((s) => s.toLowerCase().includes(n));
      if (match) return wb.Sheets[match];
    }
    return null;
  };
  const checklistSheet = find('check', 'item') ?? wb.Sheets[wb.SheetNames[0]];
  const machineSheet = find('machine', 'info') ?? wb.Sheets[wb.SheetNames[1]];

  const info: Record<string, string> = {};
  for (const row of XLSX.utils.sheet_to_json<unknown[]>(machineSheet, { header: 1, defval: '' })) {
    if (row[0] && row[1]) info[normalizeHeader(row[0])] = String(row[1]).trim();
  }
  const get = (...keys: string[]) => keys.map((k) => info[k]).find(Boolean) ?? '';
  const machine = {
    machineName: get('machine_name', 'machinename', 'name'),
    machineCode: get('machine_code', 'machinecode', 'code', 'machine_id'),
    customer: get('customer', 'customer_name'),
    cwo: get('cwo', 'cwo_number', 'work_order'),
    version: get('checklist_version', 'version', 'rev'),
  };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(checklistSheet, { defval: '' }).map((row) => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(row)) out[normalizeHeader(k)] = String(row[k]).trim();
    return out;
  });
  const valid = rows.filter((r) => r.test_procedure && r.test_procedure.length > 2);
  const items: TemplateItem[] = valid.map((r, i) => {
    const rr = (r.remarks_required ?? '').toUpperCase();
    return {
      itemNo: r.item_no || pad(i + 1),
      category: r.category || 'General',
      procedure: r.test_procedure,
      expected: r.expected_value ?? '',
      remarksRule: (rr === 'Y' || rr === 'M' ? rr : 'N') as RemarksRule,
      failInstruction: r.fail_instruction ?? '',
    };
  });
  const photoPlan: { name: string; names: string[] }[] = [];
  for (const r of valid) {
    const n = safeName(r.photo_filename);
    if (!n) continue;
    const cat = safeName(r.category) || 'General';
    let group = photoPlan.find((g) => g.name.toLowerCase() === cat.toLowerCase());
    if (!group) photoPlan.push((group = { name: cat, names: [] }));
    if (!group.names.some((x) => x.toLowerCase() === n.toLowerCase())) group.names.push(n);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  if (!machine.machineName) errors.push('Machine name is missing in the MachineInfo sheet.');
  if (!machine.machineCode) errors.push('Machine code is missing in the MachineInfo sheet.');
  if (items.length === 0) errors.push('No checklist items were found.');
  if (!machine.cwo) warnings.push('CWO number is missing. You can type it before you start.');

  return { machine, items, photoPlan, errors, warnings, categoryCount: new Set(items.map((i) => i.category)).size };
}

const SAMPLE_HEADER = ['Item No', 'Category', 'Test Procedure', 'Expected Value', 'Photo Required', 'Photo Filename', 'Remarks Required', 'Fail Instruction'];

/** A blank-but-valid checklist workbook people can fill in and import. */
export function buildChecklistTemplateWorkbook(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const rows = [
    SAMPLE_HEADER,
    ['S-01', 'Safety', 'Emergency stop stops the machine within 1 second', 'Stops within 1 s', 'N', '', 'N', 'Do not ship. Rewire the E-stop relay and retest.'],
    ['M-01', 'Mechanical', 'Belt tension measured at midspan', '12 mm deflection', 'Y', 'belt-tension.jpg', 'M', 'Adjust the take-up bolts and measure again.'],
    ['E-01', 'Electrical', 'Motor supply voltage at the terminal box', '380 V +/- 5%', 'Y', 'motor-voltage.jpg', 'Y', ''],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [8, 14, 50, 24, 8, 22, 10, 40].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, sheet, 'Checklist');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Machine Name', 'Conveyor A'], ['Machine Code', 'CONV-001'], ['Customer', 'Customer name'], ['CWO', 'CWO-0000'], ['Checklist Version', 'v1.0']]),
    'MachineInfo',
  );
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}
