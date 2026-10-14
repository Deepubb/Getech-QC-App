import { AlertTriangle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppBar, Field, toast } from '../components/ui';
import { plural } from '../core/format';
import { findShotList, useApp } from '../data/store';

export function ChecklistDetails() {
  const nav = useNavigate();
  const { draft, settings, shotlists, createChecklist, saveShotList } = useApp();
  const [form, setForm] = useState(() => ({ ...(draft?.machine ?? { machineName: '', machineCode: '', customer: '', cwo: '' }), engineer: settings.engineerName }));
  const [keepNames, setKeepNames] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!draft) return <Navigate to="/checklists/new" replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const blocking = draft.errors.filter((e) => !e.startsWith('Machine'));
  const missing = !form.machineName.trim() || !form.machineCode.trim();
  const existingList = findShotList(shotlists, form.machineCode);

  async function start() {
    if (missing) return toast('Machine name and machine code are required.', 'bad');
    setBusy(true);
    try {
      const { engineer, ...machine } = form;
      const id = await createChecklist(
        { machineName: machine.machineName.trim(), machineCode: machine.machineCode.trim(), customer: machine.customer.trim(), cwo: machine.cwo.trim() },
        draft!.items,
        engineer.trim() || settings.engineerName,
      );
      if (keepNames && draft!.photoNames.length) await saveShotList(machine.machineCode, draft!.photoNames);
      toast(draft!.items.length ? 'Checklist started.' : 'Checklist started. Add items in the editor.', 'good');
      nav(`/checklists/${id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <AppBar title="Checklist details" sub={draft.fileName ?? (draft.source === 'template' ? 'From template' : 'Empty checklist')} />
      <main className="content">
        {draft.source !== 'blank' ? (
          <div className="card flat stack" style={{ gap: 8 }}>
            <b>
              {plural(draft.items.length, 'item')} in {plural(draft.categoryCount, 'category', 'categories')}
            </b>
            {blocking.map((e) => (
              <div key={e} className="row hint bad">
                <XCircle size={16} /> {e}
              </div>
            ))}
            {draft.warnings.map((w) => (
              <div key={w} className="row hint" style={{ color: 'var(--warn)' }}>
                <AlertTriangle size={16} /> {w}
              </div>
            ))}
          </div>
        ) : null}

        <div className="card stack">
          <Field label="Machine name">
            <input value={form.machineName} onChange={set('machineName')} autoComplete="off" />
          </Field>
          <Field label="Machine code">
            <input value={form.machineCode} onChange={set('machineCode')} className="mono" autoComplete="off" />
          </Field>
          <Field label="Customer">
            <input value={form.customer} onChange={set('customer')} />
          </Field>
          <Field label="CWO number">
            <input value={form.cwo} onChange={set('cwo')} className="mono" />
          </Field>
          <Field label="Engineer">
            <input value={form.engineer} onChange={set('engineer')} />
          </Field>
        </div>

        {draft.photoNames.length > 0 ? (
          <label className="card flat check">
            <input type="checkbox" checked={keepNames} onChange={(e) => setKeepNames(e.target.checked)} />
            <span className="small">
              This Excel file lists {plural(draft.photoNames.length, 'photo name')}. Save them as the shot list for this machine, so photo evidence can start with them.
              {existingList ? ' This replaces the saved list for this machine code.' : ''} The checklist itself does not use them.
            </span>
          </label>
        ) : null}

        <button className="btn btn-primary btn-block" disabled={busy || missing || blocking.some((e) => e.startsWith('No checklist'))} onClick={start}>
          Start checklist
        </button>
      </main>
    </div>
  );
}
