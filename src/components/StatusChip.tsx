import { CheckCircle2, CircleDashed, Clock, UploadCloud } from 'lucide-react';
import { checklistLabel, evidenceLabel } from '../core/rules';
import type { Checklist, EvidenceSet } from '../core/types';

export function ChecklistChip({ c }: { c: Checklist }) {
  const s = checklistLabel(c);
  if (s === 'exported')
    return (
      <span className="chip ok">
        <CheckCircle2 />
        Exported
      </span>
    );
  if (s === 'completed')
    return (
      <span className="chip warn">
        <UploadCloud />
        Not exported
      </span>
    );
  return (
    <span className="chip">
      <Clock />
      In progress
    </span>
  );
}

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
