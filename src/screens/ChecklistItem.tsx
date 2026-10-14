import { Check, ChevronLeft, ChevronRight, Lock, Minus, TriangleAlert, X } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppBar, toast, vibrate } from '../components/ui';
import { itemProblems } from '../core/rules';
import type { ItemResult } from '../core/types';
import { nowISO } from '../core/ids';
import { useApp } from '../data/store';

const RESULTS: { r: Exclude<ItemResult, 'pending'>; label: string; Icon: typeof Check }[] = [
  { r: 'ok', label: 'OK', Icon: Check },
  { r: 'nok', label: 'NOK', Icon: X },
  { r: 'na', label: 'N/A', Icon: Minus },
];

export function ChecklistItemScreen() {
  const { id = '', itemId = '' } = useParams();
  const nav = useNavigate();
  const { checklists, updateChecklist } = useApp();
  const c = checklists.find((x) => x.id === id);
  const idx = c ? c.items.findIndex((i) => i.id === itemId) : -1;
  if (!c || idx < 0) return <Navigate to={c ? `/checklists/${c.id}` : '/'} replace />;
  const it = c.items[idx];
  const locked = c.status !== 'in_progress';
  const problems = itemProblems(it);

  const change = (patch: Partial<typeof it>) =>
    updateChecklist(c.id, (draft) => {
      const target = draft.items.find((x) => x.id === it.id);
      if (!target) return;
      Object.assign(target, patch);
      if (target.completedAt && itemProblems(target).length) target.completedAt = null;
    });
  const go = (to: number) => nav(`/checklists/${c.id}/items/${c.items[to].id}`, { replace: true });

  async function saveAndNext() {
    if (problems.length) return;
    await change({ completedAt: it.completedAt ?? nowISO() });
    vibrate(18);
    const rest = [...c!.items.slice(idx + 1), ...c!.items.slice(0, idx)];
    const next = rest.find((x) => !x.completedAt && x.id !== it.id);
    if (next) {
      nav(`/checklists/${c!.id}/items/${next.id}`, { replace: true });
      window.scrollTo(0, 0);
    } else {
      toast('All items done. Complete the checklist to export it.', 'good');
      nav(`/checklists/${c!.id}`, { replace: true });
    }
  }

  const rule = it.remarksRule === 'Y' ? 'Required' : it.remarksRule === 'M' ? 'Required if NOK' : 'Optional';

  return (
    <div className="shell">
      <AppBar title={`Item ${idx + 1} of ${c.items.length}`} sub={`${c.machineCode} · ${it.itemNo}`} back={`/checklists/${c.id}`} />
      <main className="content with-bar">
        {locked ? (
          <div className="banner info">
            <Lock />
            <span>This checklist is complete. Reopen it from the export screen to change results.</span>
          </div>
        ) : null}
        <div className="card stack">
          <div className="between">
            <span className="chip amber">{it.category}</span>
            <span className="mono small muted">{it.itemNo}</span>
          </div>
          <p className="procedure">{it.procedure}</p>
          {it.expected ? (
            <div className="expected">
              <div className="eyebrow">Expected</div>
              <div style={{ marginTop: 4 }}>{it.expected}</div>
            </div>
          ) : null}
        </div>

        <div className="results" role="radiogroup" aria-label="Result">
          {RESULTS.map(({ r, label, Icon }) => (
            <button
              key={r}
              role="radio"
              aria-checked={it.result === r}
              disabled={locked}
              className={`result ${r} ${it.result === r ? 'on' : ''}`}
              onClick={() => {
                vibrate();
                void change({ result: r });
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>

        {it.result === 'nok' && it.failInstruction ? (
          <div className="banner bad">
            <TriangleAlert />
            <span>
              <b>If it fails: </b>
              {it.failInstruction}
            </span>
          </div>
        ) : null}

        <div className="card stack">
          <div className="between">
            <span className="eyebrow">Remarks</span>
            <span className={`chip ${it.remarksRule !== 'N' ? 'warn' : ''}`}>{rule}</span>
          </div>
          <label className="field">
            <span className="sr-only">Remarks</span>
            <textarea
              key={it.id}
              defaultValue={it.remarks}
              disabled={locked}
              placeholder="What you saw, measured or adjusted"
              onChange={(e) => void change({ remarks: e.target.value })}
            />
          </label>
        </div>
      </main>

      <div className="actionbar">
        <div>
          {!locked && problems.length ? <div className="hint bad" style={{ textAlign: 'center' }}>{problems.join(' · ')}</div> : null}
          <div className="nav">
            <button className="btn" aria-label="Previous item" disabled={idx === 0} onClick={() => go(idx - 1)}>
              <ChevronLeft />
            </button>
            {locked ? (
              <button className="btn" onClick={() => nav(`/checklists/${c.id}`)}>
                Back to list
              </button>
            ) : (
              <button className="btn btn-primary" disabled={problems.length > 0} onClick={saveAndNext}>
                {it.completedAt ? 'Saved · next' : 'Save and next'}
              </button>
            )}
            <button className="btn" aria-label="Next item" disabled={idx === c.items.length - 1} onClick={() => go(idx + 1)}>
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
