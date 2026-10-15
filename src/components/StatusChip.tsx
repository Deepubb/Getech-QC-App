import { CheckCircle2, CircleDashed, UploadCloud } from 'lucide-react';
import { evidenceLabel } from '../core/rules';
import type { EvidenceSet } from '../core/types';

export function EvidenceChip({ e }: { e: EvidenceSet }) {
  const s = evidenceLabel(e);
  if (s === 'exported')
    return (
      <span className="chip ok">
        <CheckCircle2 />
        Exported
      </span>
    );
  if (s === 'not_exported')
    return (
      <span className="chip warn">
        <UploadCloud />
        Not exported
      </span>
    );
  return (
    <span className="chip">
      <CircleDashed />
      No photos
    </span>
  );
}
