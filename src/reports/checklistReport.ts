import type ExcelJS from 'exceljs';
import titleBlockUrl from '../assets/title-block.png';
import type { Checklist, ChecklistItem } from '../core/types';

/*
 * GeTech QC buyoff layout, ported from the native app's reportExcelBuilder.ts.
 * Differences: no photos (photo evidence is exported separately) and no signature images;
 * the sign-off cells stay blank for signing on paper.
 */

const ARGB = {
  red: 'FF8B0000',
  white: 'FFFFFFFF',
  text: 'FF1A1A1A',
  borderLight: 'FFCCCCCC',
  borderMid: 'FF999999',
  zebra: 'FFFAFAFA',
  ctyBg: 'FFF9F9F9',
  labelBg: 'FFF2F2F2',
  expectedGrey: 'FF555555',
} as const;

const COLUMN_WIDTHS = [10, 34, 6, 6, 7, 56]; // landscape A4
const TITLE_BLOCK_ASPECT = 2710 / 166;
const PX_PER_CHAR_UNIT = 7;
const PX_TO_PT = 0.75;

const thinBorder = (argb: string): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb } },
  left: { style: 'thin', color: { argb } },
  bottom: { style: 'thin', color: { argb } },
  right: { style: 'thin', color: { argb } },
});
const fillSolid = (argb: string): ExcelJS.FillPattern => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function ddmmyyyy(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function groupByCategory(items: ChecklistItem[]): Map<string, ChecklistItem[]> {
  const grouped = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }
  return grouped;
}

async function loadTitleBlock(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(titleBlockUrl);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function buildChecklistReport(c: Checklist): Promise<Blob> {
  const { default: Excel } = await import('exceljs');
  const workbook = new Excel.Workbook();
  workbook.creator = 'GeTech QC';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('QC Buyoff', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: false,
      scale: 100,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.25 },
    },
    headerFooter: { oddFooter: '&CGeTech — QC Buyoff Report — Page &P of &N' },
    views: [{ state: 'normal', showGridLines: false }],
  });
  ws.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  // Title block image across the full width.
  const sheetWidthPx = COLUMN_WIDTHS.reduce((s, w) => s + w, 0) * PX_PER_CHAR_UNIT;
  const imageHeightPx = Math.round(sheetWidthPx / TITLE_BLOCK_ASPECT);
  ws.mergeCells('A1:F1');
  ws.getRow(1).height = Math.ceil(imageHeightPx * PX_TO_PT) + 4;
  ws.getCell('A1').border = { bottom: { style: 'medium', color: { argb: 'FF000000' } } };
  const title = await loadTitleBlock();
  if (title) {
    const imageId = workbook.addImage({ buffer: title, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 0, row: 0 } as ExcelJS.Anchor, ext: { width: sheetWidthPx, height: imageHeightPx }, editAs: 'absolute' });
  } else {
    ws.getCell('A1').value = 'GeTech — QC BUYOFF CHECKLIST';
    ws.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: ARGB.red } };
  }

  // Machine information.
  const label = {
    font: { name: 'Arial', size: 10, bold: true, color: { argb: ARGB.text } },
    fill: fillSolid(ARGB.labelBg),
    alignment: { vertical: 'middle' as const, horizontal: 'left' as const },
    border: thinBorder(ARGB.borderMid),
  };
  const value = {
    font: { name: 'Arial', size: 10, color: { argb: ARGB.text } },
    alignment: { vertical: 'middle' as const, horizontal: 'left' as const, wrapText: true },
    border: thinBorder(ARGB.borderMid),
  };
  ws.getRow(2).height = 22;
  ws.getCell('A2').value = 'Machine Name:';
  ws.getCell('B2').value = c.machineName;
  ws.getCell('C2').value = 'Date:';
  ws.getCell('D2').value = ddmmyyyy(c.updatedAt);
  ws.getCell('E2').value = 'Customer:';
  ws.getCell('F2').value = c.customer;
  ['A2', 'C2', 'E2'].forEach((a) => Object.assign(ws.getCell(a), label));
  ['B2', 'D2', 'F2'].forEach((a) => Object.assign(ws.getCell(a), value));
  ws.getRow(3).height = 22;
  ws.getCell('A3').value = 'Machine Code:';
  ws.mergeCells('B3:D3');
  ws.getCell('B3').value = c.machineCode;
  ws.getCell('E3').value = 'CWO:';
  ws.getCell('F3').value = c.cwo;
  ['A3', 'E3'].forEach((a) => Object.assign(ws.getCell(a), label));
  ['B3', 'F3'].forEach((a) => Object.assign(ws.getCell(a), value));

  // Table header.
  const header = ws.getRow(4);
  header.height = 22;
  ['CTY', 'TEST PROCEDURE', 'NA', 'OK', 'N OK', 'REMARKS'].forEach((text, i) => {
    const cell = header.getCell(i + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: ARGB.white } };
    cell.fill = fillSolid(ARGB.red);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(ARGB.red);
  });

  // Rows, grouped by category with the category cell merged down the group.
  let rowIdx = 5;
  let zebra = 0;
  for (const [category, items] of groupByCategory(c.items)) {
    const groupStart = rowIdx;
    items.forEach((item, indexInGroup) => {
      const row = ws.getRow(rowIdx);
      const rowFill = zebra++ % 2 === 1 ? fillSolid(ARGB.zebra) : undefined;
      row.height = Math.max(30, 15 * Math.ceil(((item.remarks || '').length + 1) / 60) + 12);

      const cty = row.getCell(1);
      if (indexInGroup === 0) cty.value = category;
      cty.font = { name: 'Arial', size: 12, bold: true, color: { argb: ARGB.text } };
      cty.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cty.fill = fillSolid(ARGB.ctyBg);
      cty.border = thinBorder(ARGB.borderLight);

      const proc = row.getCell(2);
      proc.value = item.expected
        ? {
            richText: [
              { text: item.procedure, font: { name: 'Arial', size: 10, color: { argb: ARGB.text } } },
              { text: `\n${item.expected}`, font: { name: 'Arial', size: 9, italic: true, color: { argb: ARGB.expectedGrey } } },
            ],
          }
        : item.procedure;
      if (!item.expected) proc.font = { name: 'Arial', size: 10, color: { argb: ARGB.text } };
      proc.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      proc.border = thinBorder(ARGB.borderLight);
      if (rowFill) proc.fill = rowFill;

      const marks: [number, boolean][] = [
        [3, item.result === 'na'],
        [4, item.result === 'ok'],
        [5, item.result === 'nok'],
      ];
      for (const [col, on] of marks) {
        const cell = row.getCell(col);
        cell.value = on ? '✓' : '';
        cell.font = { name: 'Arial', size: 14, bold: true, color: { argb: ARGB.text } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder(ARGB.borderLight);
        if (rowFill) cell.fill = rowFill;
      }

      const remarks = row.getCell(6);
      remarks.value = item.remarks || '';
      remarks.font = { name: 'Arial', size: 10, color: { argb: ARGB.text } };
      remarks.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      remarks.border = thinBorder(ARGB.borderLight);
      if (rowFill) remarks.fill = rowFill;
      rowIdx++;
    });
    if (rowIdx - 1 > groupStart) ws.mergeCells(groupStart, 1, rowIdx - 1, 1);
  }

  // Sign-off cells, left blank for signing on paper.
  ws.getRow(rowIdx).height = 6;
  const sig = rowIdx + 1;
  ws.getRow(sig).height = 48;
  const labels = [`Checked by: ${c.engineer}`, 'Approved by:', 'Reviewed by:'];
  (
    [
      ['A', 'B'],
      ['C', 'D'],
      ['E', 'F'],
    ] as const
  ).forEach(([from, to], i) => {
    ws.mergeCells(`${from}${sig}:${to}${sig}`);
    const cell = ws.getCell(`${from}${sig}`);
    cell.value = labels[i];
    cell.font = { name: 'Arial', size: 10, color: { argb: ARGB.text } };
    cell.alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(ARGB.borderMid);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
