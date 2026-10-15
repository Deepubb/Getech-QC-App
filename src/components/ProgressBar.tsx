import type { Progress } from '../core/evidence';

/** Taken in green, not applicable in grey, the rest still to take. */
export function ProgressBar({ p }: { p: Progress }) {
  const pct = (n: number) => (p.total ? `${(n / p.total) * 100}%` : '0%');
  return (
    <div className="resultbar" role="img" aria-label={`${p.taken} of ${p.total} taken, ${p.na} not applicable`}>
      <i className="ok" style={{ width: pct(p.taken) }} />
      <i className="na" style={{ width: pct(p.na) }} />
    </div>
  );
}
