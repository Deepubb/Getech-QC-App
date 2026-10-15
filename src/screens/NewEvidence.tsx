import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppBar, Field, toast } from '../components/ui';
import { safeName } from '../core/evidence';
import { plural } from '../core/format';
import { findPhotoTemplate, useApp, type CategoryPlan } from '../data/store';

export function NewEvidence() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { photoTemplates, settings, createEvidence } = useApp();
  const preset = photoTemplates.find((t) => t.id === params.get('template'));
  const [form, setForm] = useState({ title: '', machineCode: preset?.machineCode ?? '', customer: '', cwo: '' });
  const matched = useMemo(() => preset ?? findPhotoTemplate(photoTemplates, form.machineCode), [preset, photoTemplates, form.machineCode]);
  const [custom, setCustom] = useState<CategoryPlan | null>(null);
  const [newCat, setNewCat] = useState('');
  const plan: CategoryPlan = custom ?? matched?.categories ?? settings.defaultCategories.map((name) => ({ name, names: [] }));
  const plannedCount = plan.reduce((a, c) => a + c.names.length, 0);

  function addCat() {
    const n = safeName(newCat);
    if (!n) return;
    if (plan.some((c) => c.name.toLowerCase() === n.toLowerCase())) return toast(`${n} is already in the list.`, 'bad');
    setCustom([...plan, { name: n, names: [] }]);
    setNewCat('');
  }

  async function start() {
    if (!form.title.trim()) return toast('Type the machine name first.', 'bad');
    if (!plan.length) return toast('Add at least one category.', 'bad');
    const id = await createEvidence({ title: form.title.trim(), machineCode: form.machineCode.trim(), customer: form.customer.trim(), cwo: form.cwo.trim() }, plan);
    nav(`/evidence/${id}`, { replace: true });
  }

  return (
    <div className="shell">
      <AppBar title="New photo evidence" />
      <main className="content">
        <div className="card stack">
          <Field label="Machine name">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Conveyor A" autoFocus />
          </Field>
          <Field label="Machine code (optional)" hint="Finds the categories and photo names you saved for this machine.">
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
          <div className="between">
            <span className="eyebrow">Categories · one folder each in the zip</span>
          </div>
          {matched && !custom ? (
            <div className="hint">
              From the saved template for <b className="mono">{matched.machineCode}</b>
              {plannedCount ? `, with ${plural(plannedCount, 'photo name')} ready to take` : ''}.
            </div>
          ) : null}
          <div className="cats">
            {plan.map((c) => (
              <span key={c.name} className="cat-chip">
                {c.name}
                {c.names.length ? <span className="muted small">· {c.names.length}</span> : null}
                <button aria-label={`Remove ${c.name}`} onClick={() => setCustom(plan.filter((x) => x !== c))}>
                  <X />
                </button>
              </span>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              addCat();
            }}
          >
            <input className="input grow" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add a category" aria-label="New category name" />
            <button className="btn" type="submit" disabled={!safeName(newCat)}>
              <Plus /> Add
            </button>
          </form>
          <p className="hint">You can add, rename or remove categories later too.</p>
        </div>

        <button className="btn btn-primary btn-block" onClick={start}>
          Start taking photos
        </button>
      </main>
    </div>
  );
}
