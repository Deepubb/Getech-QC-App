import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AppBar, ConfirmSheet, Field, Sheet, toast } from '../components/ui';
import { uid } from '../core/ids';
import { pad } from '../core/names';
import type { ChecklistItem, RemarksRule } from '../core/types';
import { useApp } from '../data/store';

const BLANK = { category: '', procedure: '', expected: '', remarksRule: 'N' as RemarksRule, failInstruction: '' };

export function EditChecklist() {
  const { id = '' } = useParams();
  const { checklists, updateChecklist } = useApp();
  const c = checklists.find((x) => x.id === id);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [removing, setRemoving] = useState<ChecklistItem | null>(null);
  if (!c) return <Navigate to="/" replace />;
  if (c.status !== 'in_progress') return <Navigate to={`/checklists/${c.id}`} replace />;

  const categories = [...new Set([...c.items.map((i) => i.category), 'Safety', 'Mechanical', 'Electrical', 'Functional', 'Software/GUI'])];
  const setMachine = (k: 'machineName' | 'machineCode' | 'customer' | 'cwo') => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    if (v !== c[k] && (v || (k !== 'machineName' && k !== 'machineCode'))) void updateChecklist(c.id, (d) => void (d[k] = v));
  };
  const move = (from: number, to: number) =>
    updateChecklist(c.id, (d) => {
      const [x] = d.items.splice(from, 1);
      d.items.splice(to, 0, x);
    });

  function addItem() {
    if (form.procedure.trim().length < 3) return toast('Write the test procedure first.', 'bad');
    const category = form.category.trim() || 'General';
    const prefix = category.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() || 'X';
    const n = c!.items.filter((i) => i.category === category).length + 1;
    const item: ChecklistItem = {
      id: uid(),
      itemNo: `${prefix}-${pad(n)}`,
      category,
      procedure: form.procedure.trim(),
      expected: form.expected.trim(),
      remarksRule: form.remarksRule,
      failInstruction: form.failInstruction.trim(),
      result: 'pending',
      remarks: '',
      completedAt: null,
    };
    void updateChecklist(c!.id, (d) => {
      // Insert after the last item of the same category so groups stay together.
      let at = -1;
      d.items.forEach((x, i) => {
        if (x.category === category) at = i;
      });
      d.items.splice(at >= 0 ? at + 1 : d.items.length, 0, item);
    });
    setForm({ ...BLANK, category });
    setAdding(false);
    toast(`Added ${item.itemNo}.`, 'good');
  }

  return (
    <div className="shell">
      <AppBar title="Edit checklist" sub={c.machineCode} back={`/checklists/${c.id}`} />
      <main className="content">
        <section className="card stack">
          <div className="eyebrow">Machine details</div>
          <Field label="Machine name">
            <input defaultValue={c.machineName} onBlur={setMachine('machineName')} />
          </Field>
          <Field label="Machine code">
            <input defaultValue={c.machineCode} className="mono" onBlur={setMachine('machineCode')} />
          </Field>
          <div className="btn-row">
            <Field label="Customer">
              <input defaultValue={c.customer} onBlur={setMachine('customer')} />
            </Field>
            <Field label="CWO">
              <input defaultValue={c.cwo} className="mono" onBlur={setMachine('cwo')} />
            </Field>
          </div>
        </section>

        <div className="section-title">
          <h2>{c.items.length} items</h2>
        </div>
        <div className="list">
          {c.items.map((it, i) => (
            <div key={it.id} className="li" style={{ cursor: 'default', gridTemplateColumns: 'auto 1fr auto' }}>
              <span className="no">{it.itemNo}</span>
              <span className="t">
                {it.procedure}
                <div className="s">{it.category}</div>
              </span>
              <span className="row" style={{ gap: 2 }}>
                <button className="iconbtn" aria-label={`Move ${it.itemNo} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp />
                </button>
                <button className="iconbtn" aria-label={`Move ${it.itemNo} down`} disabled={i === c.items.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown />
                </button>
                <button className="iconbtn" aria-label={`Delete ${it.itemNo}`} onClick={() => setRemoving(it)} style={{ color: 'var(--nok)' }}>
                  <Trash2 />
                </button>
              </span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-block" onClick={() => setAdding(true)}>
          <Plus /> Add item
        </button>
      </main>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add an item">
        <Field label="Category">
          <input list="cat-options" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Safety" />
        </Field>
        <datalist id="cat-options">
          {categories.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <Field label="Test procedure">
          <textarea value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} style={{ minHeight: 80 }} />
        </Field>
        <Field label="Expected value (optional)">
          <input value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} />
        </Field>
        <Field label="Remarks">
          <select value={form.remarksRule} onChange={(e) => setForm({ ...form, remarksRule: e.target.value as RemarksRule })}>
            <option value="N">Optional</option>
            <option value="Y">Always required</option>
            <option value="M">Required only when NOK</option>
          </select>
        </Field>
        <Field label="If it fails (optional)">
          <input value={form.failInstruction} onChange={(e) => setForm({ ...form, failInstruction: e.target.value })} placeholder="What to do on NOK" />
        </Field>
        <button className="btn btn-primary btn-block" onClick={addItem}>
          Add item
        </button>
      </Sheet>
      <ConfirmSheet
        open={!!removing}
        title={`Delete ${removing?.itemNo ?? ''}?`}
        body={removing?.procedure}
        confirmLabel="Delete"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && void updateChecklist(c.id, (d) => void (d.items = d.items.filter((x) => x.id !== removing.id)))}
      />
    </div>
  );
}
