import * as XLSX from 'xlsx';
import { sheetToList, type ParsedList } from './masterList';

/** Reads every sheet of an uploaded master Excel. Loaded on demand, so the Excel reader stays out of the app start-up. */
export function readMasterWorkbook(data: ArrayBuffer): { lists: ParsedList[]; skipped: string[] } {
  const wb = XLSX.read(data, { type: 'array' });
  const lists: ParsedList[] = [];
  const skipped: string[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', blankrows: false, raw: false });
    const list = sheetToList(name, rows);
    if (list) lists.push(list);
    else skipped.push(name);
  }
  return { lists, skipped };
}
