import { ChevronRight, FolderPlus, MoreHorizontal, Package, Pencil, Save, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { EvidenceChip } from '../components/StatusChip';
import { Thumb } from '../components/Thumb';
import { AppBar, ConfirmSheet, Field, Sheet, toast } from '../components/ui';
import { categoryTaken, evidenceProblems, safeName, toTake } from '../core/evidence';
import { fmtSize, plural } from '../core/format';
import { photoBytes, photoCount } from '../core/rules';
import { findPhotoTemplate, planOf, useApp } from '../data/store';

export function EvidenceScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { evidence, photoTemplates, updateEvidence, deleteEvidence, savePhotoTemplate, addCategory } = useApp();
  const e = evidence.find((x) => x.id === id);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'details' | 'template' | 'delete' | 'category' | null>(null);
  const [catName, setCatName] = useState('');
  if (!e) return <Navigate to="/?m=evidence" replace />;

  const n = photoCount(e);
  const problems = evidenceProblems(e);
  const existing = findPhotoTemplate(photoTemplates, e.machineCode);
  const cleanCat = safeName(catName);
  const catExists = !!cleanCat && categoryTaken(e, cleanCat);

  return (
    <div className="shell">
      <AppBar
        title={e.title || e.machineCode || 'Photo evidence'}
        sub={[e.machineCode, e.cwo].filter(Boolean).join(' · ') || 'Photo evidence'}
        back="/?m=evidence"
        actions={
          <button className="iconbtn" aria-label="More actions" onClick={() => setMenu(true)}>
            <MoreHorizontal />
          </button>
        }
      />
      <main className="content with-bar">
        <section className="card stack">
          <div className="between">
            <div>
              <div className="eyebrow">Photo evidence</div>
              <div className="tnum" style={{ font: '600 26px/1.1 var(--font-head)', marginTop: 4 }}>
                {n}
                <span className="muted" style={{ fontSize: 16 }}>
                  {' '}
                  {n === 1 ? 'photo' : 'photos'} · {plural(e.categories.length, 'category', 'categories')}
                </span>
              </div>
            </div>
            <EvidenceChip e={e} />
          </div>
          <p className="hint">Pick a category, then take photos and name each one as you go.</p>
        </section>

        {e.categories.map((c) => {
          const todo = toTake(c);
          const unnamed = c.photos.filter((p) => !safeName(p.name)).length;
          return (
            <Link key={c.id} to={`/evidence/${e.id}/c/${c.id}`} className="card card-link stack">
              <div className="catcard">
                <div style={{ minWidth: 0 }}>
                  <h3 className="wrap-anywhere">{c.name || 'Unnamed category'}</h3>
                  <div className="small muted">
                    {plural(c.photos.length, 'photo')}
                    {todo.length ? ` · ${todo.length} to take` : ''}
                    {unnamed ? <span style={{ color: 'var(--nok)' }}> · {unnamed} unnamed</span> : null}
                  </div>
                </div>
                <ChevronRight className="muted" />
              </div>
              {c.photos.length ? (
                <div className="strip">
                  {c.photos.slice(-5).reverse().map((p) => (
                    <Thumb key={p.id} id={p.id} />
                  ))}
                </div>
              ) : null}
            </Link>
          );
        })}

        <button className="btn btn-block" onClick={() => setSheet('category')}>
          <FolderPlus /> Add a category
        </button>
      </main>

      <div className="actionbar">
        <div>
          {problems.length && n ? (
            <div className="hint bad" style={{ textAlign: 'center' }}>
              <TriangleAlert size={14} style={{ verticalAlign: '-2px' }} /> {plural(problems.length, 'photo name')} to fix before export
            </div>
          ) : null}
          <button className="btn btn-primary btn-block" disabled={!n} onClick={() => nav(`/evidence/${e.id}/export`)}>
            <Package /> Export {plural(n, 'photo')} as zip{n ? ` · ${fmtSize(photoBytes(e))}` : ''}
          </button>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Photo evidence">
        <div className="list">
          <button className="li" onClick={() => (setMenu(false), setSheet('details'))}>
            <Pencil className="muted" />
            <span className="t">
              <b>Edit machine details</b>
              <div className="s">Name, code, CWO, customer</div>
            </span>
            <span />
          </button>
          <button className="li" onClick={() => (setMenu(false), setSheet('template'))}>
            <Save className="muted" />
            <span className="t">
              <b>Save as template for next time</b>
              <div className="s">{e.machineCode ? `Categories and photo names for ${e.machineCode}` : 'Needs a machine code'}</div>
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

      <Sheet open={sheet === 'category'} onClose={() => setSheet(null)} title="Add a category">
        <form
          className="stack"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!cleanCat || catExists) return;
            const cid = await addCategory(e.id, cleanCat);
            setCatName('');
            setSheet(null);
            nav(`/evidence/${e.id}/c/${cid}`);
          }}
        >
          <Field label="Category name" hint={catExists ? <span className="bad">There is already a category with that name.</span> : 'This is the folder name in the zip.'}>
            <input value={catName} onChange={(ev) => setCatName(ev.target.value)} placeholder="e.g. Pneumatic" autoFocus />
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={!cleanCat || catExists}>
            Add and open
          </button>
        </form>
      </Sheet>

      <DetailsSheet
        open={sheet === 'details'}
        initial={e}
        onClose={() => setSheet(null)}
        onSave={(v) => updateEvidence(e.id, (d) => Object.assign(d, v)).then(() => toast('Details saved.', 'good'))}
      />
      <ConfirmSheet
        open={sheet === 'template'}
        title={existing ? 'Replace the saved template?' : 'Save as template?'}
        body={
          e.machineCode
            ? `The ${plural(e.categories.length, 'category', 'categories')} and their photo names become the template for ${e.machineCode}. Next time you start photo evidence for this machine, they are ready to take.`
            : 'Add a machine code in Edit machine details first. Templates are saved per machine code.'
        }
        confirmLabel={existing ? 'Replace' : 'Save'}
        onClose={() => setSheet(null)}
        onConfirm={async () => {
          if (!e.machineCode) return;
          const r = await savePhotoTemplate(e.machineCode, planOf(e));
          toast(r === 'created' ? 'Template saved.' : 'Template replaced.', 'good');
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
          nav('/?m=evidence', { replace: true });
        }}
      />
    </div>
  );
}

function DetailsSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: { title: string; machineCode: string; cwo: string; customer: string };
  onClose: () => void;
  onSave: (v: { title: string; machineCode: string; cwo: string; customer: string }) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <Sheet open={open} onClose={onClose} title="Machine details">
      <Field label="Machine name" hint="Also the name of the zip file.">
        <input value={v.title} onChange={(ev) => setV({ ...v, title: ev.target.value })} />
      </Field>
      <Field label="Machine code">
        <input className="mono" value={v.machineCode} onChange={(ev) => setV({ ...v, machineCode: ev.target.value })} />
      </Field>
      <div className="btn-row">
        <Field label="CWO">
          <input className="mono" value={v.cwo} onChange={(ev) => setV({ ...v, cwo: ev.target.value })} />
        </Field>
        <Field label="Customer">
          <input value={v.customer} onChange={(ev) => setV({ ...v, customer: ev.target.value })} />
        </Field>
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={!v.title.trim()}
        onClick={() => {
          onSave({ title: v.title.trim(), machineCode: v.machineCode.trim(), cwo: v.cwo.trim(), customer: v.customer.trim() });
          onClose();
        }}
      >
        Save details
      </button>
    </Sheet>
  );
}
