import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildChecklistTemplateWorkbook, parseChecklistWorkbook } from './excelParser';

function workbook(machine: unknown[][], checklist: unknown[][], names = { checklist: 'Checklist', machine: 'MachineInfo' }) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(checklist), names.checklist);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(machine), names.machine);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

const header = ['Item No', 'Category', 'Test Procedure', 'Expected Value', 'Photo Required', 'Photo Filename', 'Remarks Required', 'Fail Instruction'];
const machine = [
  ['Machine Name', 'Conveyor A'],
  ['Machine Code', 'CONV-001'],
  ['Customer', 'Acme'],
  ['CWO', 'WO-1'],
];

describe('parseChecklistWorkbook', () => {
  it('reads machine info, items and photo names', () => {
    const r = parseChecklistWorkbook(
      workbook(machine, [header, ['01', 'Electrical', 'Check motor voltage', '220V', 'Y', 'voltage.jpg', 'N', ''], ['02', 'Mechanical', 'Inspect belt tension', 'tight', 'Y', 'belt.jpg', 'M', 'Adjust if loose']]),
    );
    expect(r.machine).toMatchObject({ machineName: 'Conveyor A', machineCode: 'CONV-001', customer: 'Acme', cwo: 'WO-1' });
    expect(r.items).toHaveLength(2);
    expect(r.items[1]).toMatchObject({ itemNo: '02', category: 'Mechanical', procedure: 'Inspect belt tension', expected: 'tight', remarksRule: 'M', failInstruction: 'Adjust if loose' });
    expect(r.photoPlan).toEqual([
      { name: 'Electrical', names: ['voltage'] },
      { name: 'Mechanical', names: ['belt'] },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.categoryCount).toBe(2);
  });

  it('defaults item numbers and categories and skips rows with no procedure', () => {
    const r = parseChecklistWorkbook(workbook(machine, [header, ['', '', 'Check guards', '', '', '', 'x', ''], ['', '', '', '', '', '', '', ''], ['', '', 'ab', '', '', '', '', '']]));
    expect(r.items).toEqual([{ itemNo: '01', category: 'General', procedure: 'Check guards', expected: '', remarksRule: 'N', failInstruction: '' }]);
  });

  it('reports missing machine details and no items as errors', () => {
    const r = parseChecklistWorkbook(workbook([['Customer', 'Acme']], [header]));
    expect(r.errors).toEqual(['Machine name is missing in the MachineInfo sheet.', 'Machine code is missing in the MachineInfo sheet.', 'No checklist items were found.']);
    expect(r.warnings).toHaveLength(1);
  });

  it('finds sheets by name in any order', () => {
    const r = parseChecklistWorkbook(workbook(machine, [header, ['1', 'A', 'Procedure one', '', '', '', '', '']], { checklist: 'Items', machine: 'Machine' }));
    expect(r.items).toHaveLength(1);
  });

  it('rejects a single-sheet workbook', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A']]), 'Only');
    expect(() => parseChecklistWorkbook(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })))).toThrow(/2 sheets/);
  });

  it('round-trips the blank template it offers for download', () => {
    const r = parseChecklistWorkbook(buildChecklistTemplateWorkbook());
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(3);
    expect(r.photoPlan).toEqual([
      { name: 'Mechanical', names: ['belt-tension'] },
      { name: 'Electrical', names: ['motor-voltage'] },
    ]);
  });
});
