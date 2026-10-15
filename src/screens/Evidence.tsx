import { CheckCircle2, ChevronRight, MoreHorizontal, Package, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { EvidenceChip } from '../components/StatusChip';
import { Thumb } from '../components/Thumb';
import { AppBar, ConfirmSheet, Field, Sheet, toast } from '../components/ui';
import { evidenceBytes, evidencePhotoCount, evidenceProgress, progressOf, safeName, setTitle } from '../core/evidence';
import { fmtSize, plural } from '../core/format';
import { hasChanges, listHash, rebaseOnList } from '../core/rebase';
import { useApp } from '../data/store';

export function EvidenceScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { evidence, masterLists, updateEvidence, deleteEvidence, applyList, dismissList } = useApp();
  const e = evidence.find((x) => x.id === id);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'number' | 'delete' | 'apply' | null>(null);
  const [number, setNumber] = useState(e?.number ?? '');
  if (!e) return <Navigate to="/" replace />;

  const p = evidenceProgress(e);
  const n = evidencePhotoCount(e);
  const list = masterLists.find((l) => l.machine.toLowerCase() === e.machine.toLowerCase());
  const hash = list ? listHash(list.folders) : '';
  const change = list && hash !== e.dismissedList ? rebaseOnList(e.folders, list.folders) : null;
  const showChange = !!change && hasChanges(change);

  return (
    <div className="shell">
      <AppBar
        title={setTitle(e)}
        sub={e.machine}
        back="/"
        actions={
          <button className="iconbtn" aria-label="More actions" onClick={() => setMenu(true)}>
            <MoreHorizontal />
          </button>
        }
      />
      <main className="content with-bar">
        {showChange ? (
          <div className="banner info" role="status">
            <RefreshCw />
            <span className="stack" style={{ gap: 8 }}>
              <span>
                <b>The master list for {e.machine} changed.</b> {describe(change!)}
              </span>
              <span className="row">
                <button className="btn btn-sm btn-primary" onClick={() => setSheet('apply')}>
                  Apply new names
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => void dismissList(e.id, hash)}>
                  Keep current
                </button>
              </span>
            </span>
          </div>
        ) : null}
        <section className="card stack">
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="eyebrow">Photos taken</div>
              <div className="tnum" style={{ font: '600 30px/1.1 var(--font-head)', marginTop: 4 }}>
                {p.taken}
                <span className="muted" style={{ fontSize: 17 }}> / {p.total}</span>
              </div>
            </div>
            <EvidenceChip e={e} />
          </div>
          <ProgressBar p={p} />
          <div className="small muted tnum">
            {p.missing ? `${p.missing} still to take` : 'Everything on the list is done'}
            {p.na ? ` · ${p.na} not applicable` : ''}
            {n !== p.taken ? ` · ${plural(n, 'photo')} in all` : ''}
          </div>
        </section>

        {e.folders.map((f) => {
          const fp = progressOf(f.items);
          const recent = f.items.flatMap((i) => i.photos).slice(-5).reverse();
          return (
            <Link key={f.id} to={`/evidence/${e.id}/f/${f.id}`} className="card card-link stack">
              <div className="catcard">
                <div style={{ minWidth: 0 }}>
                  <h3 className="wrap-anywhere">{f.name}</h3>
                  <div className="small muted tnum">
                    {fp.taken} of {fp.total} taken
                    {fp.na ? ` · ${fp.na} N/A` : ''}
                  </div>
                </div>
                {fp.missing ? <ChevronRight className="muted" /> : <CheckCircle2 style={{ color: 'var(--ok)' }} />}
              </div>
              <ProgressBar p={fp} />
              {recent.length ? (
                <div className="strip">
                  {recent.map((ph) => (
                    <Thumb key={ph.id} id={ph.id} />
                  ))}
                </div>
              ) : null}
            </Link>
          );
        })}
      </main>

      <div className="actionbar">
        <div>
          <button className="btn btn-primary btn-block" disabled={!n} onClick={() => nav(`/evidence/${e.id}/export`)}>
            <Package /> Export {plural(n, 'photo')} as zip{n ? ` · ${fmtSize(evidenceBytes(e))}` : ''}
          </button>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={setTitle(e)}>
        <div className="list">
          <button className="li" onClick={() => (setMenu(false), setNumber(e.number), setSheet('number'))}>
            <Pencil className="muted" />
            <span className="t">
              <b>Change machine number</b>
            </span>
            <span />
          </button>
          <button className="li" onClick={() => (setMenu(false), setSheet('delete'))}>
            <Trash2 style={{ color: 'var(--nok)' }} />
            <span className="t">
              <b style={{ color: 'var(--nok)' }}>Delete this photo evidence</b>
              <div className="s">Removes every photo of this machine from the phone</div>
            </span>
            <span />
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'number'} onClose={() => setSheet(null)} title="Machine number">
        <form
          className="stack"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!safeName(number)) return;
            await updateEvidence(e.id, (d) => void (d.number = safeName(number)));
            setSheet(null);
            toast('Machine number saved.', 'good');
          }}
        >
          <Field label="Machine number">
            <input className="mono" value={number} onChange={(ev) => setNumber(ev.target.value)} autoFocus autoCapitalize="characters" />
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={!safeName(number)}>
            Save
          </button>
        </form>
      </Sheet>
      <ConfirmSheet
        open={sheet === 'apply' && showChange}
        title="Apply new names?"
        body={`${describe(change ?? { added: 0, removed: 0, kept: 0 })} Photos already taken are kept.`}
        confirmLabel="Apply"
        onClose={() => setSheet(null)}
        onConfirm={async () => {
          await applyList(e.id);
          toast('New names applied.', 'good');
        }}
      />
      <ConfirmSheet
        open={sheet === 'delete'}
        title="Delete this photo evidence?"
        body={`All ${plural(n, 'photo')} are removed from this phone. Export the zip first if you need them.`}
        confirmLabel="Delete"
        danger
        onClose={() => setSheet(null)}
        onConfirm={async () => {
          await deleteEvidence(e.id);
          toast('Photo evidence deleted.');
          nav('/', { replace: true });
        }}
      />
    </div>
  );
}

function describe(c: { added: number; removed: number; kept: number }): string {
  const parts = [
    c.added ? `${plural(c.added, 'new name')} to take` : '',
    c.removed ? `${plural(c.removed, 'name')} removed` : '',
    c.kept ? `${plural(c.kept, 'removed name')} with photos kept` : '',
  ].filter(Boolean);
  return `${parts.join(', ')}.`;
}
