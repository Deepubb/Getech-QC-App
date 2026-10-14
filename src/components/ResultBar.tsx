import type { Checklist } from '../core/types';

export function ResultBar({ c, legend = false }: { c: Checklist; legend?: boolean }) {
  const total = c.items.length || 1;
  const done = c.items.filter((i) => i.completedAt);
  const n = (r: string) => done.filter((i) => i.result === r).length;
  const ok = n('ok');
  const nok = n('nok');
  const na = n('na');
  const pct = (x: number) => `${(x / total) * 100}%`;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="resultbar" role="img" aria-label={`${done.length} of ${c.items.length} done: ${ok} OK, ${nok} NOK, ${na} N/A`}>
        <i className="ok" style={{ width: pct(ok) }} />
        <i className="nok" style={{ width: pct(nok) }} />
        <i className="na" style={{ width: pct(na) }} />
      </div>
      {legend ? (
        <div className="legend tnum">
          <span>
            <i style={{ background: 'var(--ok)' }} />
            {ok} OK
          </span>
          <span>
            <i style={{ background: 'var(--nok)' }} />
            {nok} NOK
          </span>
          <span>
            <i style={{ background: 'var(--na)' }} />
            {na} N/A
          </span>
          <span>
            <i style={{ background: 'var(--na-weak)', border: '1px solid var(--line)' }} />
            {c.items.length - done.length} pending
          </span>
        </div>
      ) : null}
    </div>
  );
}
