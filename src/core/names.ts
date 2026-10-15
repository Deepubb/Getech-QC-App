/** Letters, digits, hyphen and underscore only; no extension; at most 100 characters. */
export function cleanName(input: string | null | undefined): string {
  return String(input ?? '')
    .trim()
    .replace(/\.(jpe?g|png|heic)$/i, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function checklistFileName(machineCode: string, date = new Date()): string {
  return `QC_Buyoff_${cleanName(machineCode) || 'machine'}_${ymd(date).replace(/-/g, '')}.xlsx`;
}
