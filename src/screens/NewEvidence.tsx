import { CheckCircle2, Circle, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Empty, Field, toast } from '../components/ui';
import { safeName, setTitle } from '../core/evidence';
import { plural } from '../core/format';
import { shotCount } from '../core/masterList';
import { useApp } from '../data/store';

export function NewEvidence() {
  const nav = useNavigate();
  const { masterLists, evidence, createEvidence } = useApp();
  const sorted = [...masterLists].sort((a, b) => a.machine.localeCompare(b.machine));
  const [listId, setListId] = useState(sorted.length === 1 ? sorted[0].id : '');
  const [ft, setFt] = useState('');
  const list = masterLists.find((l) => l.id === listId);
  const same = list && ft.trim() ? evidence.find((x) => x.machine.toLowerCase() === list.machine.toLowerCase() && x.ft.toLowerCase() === ft.trim().toLowerCase()) : undefined;

  async function start() {
    if (!list) return toast('Pick the machine first.', 'bad');
    if (!safeName(ft)) return toast('Type the FT number.', 'bad');
    const id = await createEvidence(list.id, ft);
    nav(`/evidence/${id}`, { replace: true });
  }

  if (!masterLists.length) {
    return (
      <div className="shell">
        <AppBar title="New photo evidence" back="/" />
        <main className="content">
          <Empty icon={<FileSpreadsheet />} title="No machine lists yet">
            <Link className="btn btn-primary" to="/settings">
              Go to Settings
            </Link>
          </Empty>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <AppBar title="New photo evidence" back="/" />
      <main className="content">
        <div className="eyebrow" style={{ padding: '0 4px' }}>
          Machine
        </div>
        <div className="list" role="radiogroup" aria-label="Machine">
          {sorted.map((l) => (
            <button key={l.id} className="li" role="radio" aria-checked={l.id === listId} onClick={() => setListId(l.id)}>
              {l.id === listId ? <CheckCircle2 style={{ color: 'var(--amber)' }} /> : <Circle className="muted" />}
              <span className="t">
                <b>{l.machine}</b>
                <div className="s">
                  {plural(l.folders.length, 'folder')} · {plural(shotCount(l), 'photo')}
                </div>
              </span>
              <span />
            </button>
          ))}
        </div>

        <div className="card stack">
          <Field
            label="FT number"
            hint={
              same ? (
                <span className="bad">
                  {setTitle(same)} already has photo evidence. <Link to={`/evidence/${same.id}`}>Open it</Link> instead?
                </span>
              ) : undefined
            }
          >
            <input className="mono" value={ft} onChange={(e) => setFt(e.target.value)} placeholder="e.g. FT1234" autoCapitalize="characters" />
          </Field>
        </div>

        <button className="btn btn-primary btn-block" onClick={start} disabled={!list || !safeName(ft)}>
          Start taking photos
        </button>
      </main>
    </div>
  );
}
