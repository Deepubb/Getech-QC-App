export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files });
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

/** Must be called straight from a tap: browsers reject a share that starts after a long wait. */
export async function shareFiles(files: File[], title: string): Promise<ShareOutcome> {
  if (!canShareFiles(files)) return 'unsupported';
  try {
    await navigator.share({ files, title });
    return 'shared';
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const toFile = (blob: Blob, name: string, type: string) => new File([blob], name, { type });
