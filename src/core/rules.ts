import { evidencePhotoCount } from './evidence';
import type { EvidenceSet } from './types';

export function evidenceLabel(e: EvidenceSet): 'empty' | 'exported' | 'not_exported' {
  if (!evidencePhotoCount(e)) return 'empty';
  return e.exportedAt && e.exportedAt >= e.updatedAt ? 'exported' : 'not_exported';
}

export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}
