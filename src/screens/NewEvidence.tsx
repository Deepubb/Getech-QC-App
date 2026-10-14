import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppBar, Field, toast } from '../components/ui';
import { plural } from '../core/format';
import { ymd } from '../core/names';
import { findShotList, useApp } from '../data/store';

export function NewEvidence() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { shotlists, createEvidence } = useApp();
  const preset = shotlists.find((l) => l.id === params.get('list'));
  const [form, setForm] = useState({ title: '', machineCode: preset?.machineCode ?? '', customer: '', cwo: '' });
  const [listId, setListId] = useState<string>(preset?.id ?? '');
  const [touchedList, setTouchedList] = useState(!!preset);
  const matched = useMemo(() => findShotList(shotlists, form.machineCode), [shotlists, form.machineCode]);
  const effectiveList = touchedList ? shotlists.find((l) => l.id === listId) : matched;

  async function start() {
    const title = form.title.trim() || form.machineCode.trim() || `Evidence ${ymd()}`;
    const id = await createEvidence({ title, machineCode: form.machineCode.trim(), customer: form.customer.trim(), cwo: form.cwo.trim() }, effectiveList?.names ?? []);
    toast(effectiveList ? `Started with ${plural(effectiveList.names.length, 'saved name')}.` : 'Photo evidence started.', 'good');
    nav(`/evidence/${id}`, { replace: true });
  }

  return (
    <div className="shell">
      <AppBar title="New photo evidence" />
      <main className="content">
        <p className="muted">Photo evidence is separate from the checklist. Take as many photos as you need, then export them as a zip.</p>
        <div className="card stack">
          <Field label="Title" hint="For example the machine name. Shown on your home screen.">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Conveyor A" />
          </Field>
          <Field label="Machine code (optional)" hint="Used in photo names and to find a saved shot list.">
            <input className="mono" value={form.machineCode} onChange={(e) => setForm({ ...form, machineCode: e.target.value })} placeholder="CONV-001" />
          </Field>
          <div className="btn-row">
            <Field label="CWO (optional)">
              <input className="mono" value={form.cwo} onChange={(e) => setForm({ ...form, cwo: e.target.value })} />
            </Field>
            <Field label="Customer (optional)">
              <input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="card stack">
          <Field label="Start with saved photo names" hint="A shot list only pre-fills names. It never limits how many photos you take.">
            <select
              value={touchedList ? listId : matched?.id ?? ''}
              onChange={(e) => {
                setTouchedList(true);
                setListId(e.target.value);
              }}
            >
              <option value="">No, start empty</option>
              {shotlists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.machineCode} · {plural(l.names.length, 'name')}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button className="btn btn-primary btn-block" onClick={start}>
          Start photo evidence
        </button>
      </main>
    </div>
  );
}
