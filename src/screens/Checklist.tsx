import { ClipboardList, MoreHorizontal, Pencil, LayoutTemplate, Trash2, Share2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ResultBar } from '../components/ResultBar';
import { ChecklistChip } from '../components/StatusChip';
import { AppBar, ConfirmSheet, Empty, Sheet, toast } from '../components/ui';
import { doneCount } from '../core/rules';
import type { ChecklistItem } from '../core/types';
import { findTemplate, useApp } from '../data/store';

const PILL: Record<ChecklistItem['result'], string> = { ok: 'OK', nok: 'NOK', na: 'N/A', pending: 'Pending' };

export function ChecklistScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { checklists, templates, deleteChecklist, saveTemplateFrom } = useApp();
  const c = checklists.find((x) => x.id === id);
  const [filter, setFilter] = useState<'all' | 'pending' | 'nok'>('all');
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'template' | null>(null);
  if (!c) return <Navigate to="/" replace />;

  const visible = c.items.filter((i) => (filter === 'all' ? true : filter === 'pending' ? !i.completedAt : i.completedAt && i.result === 'nok'));
  const groups: [string, ChecklistItem[]][] = [];
  for (const it of visible) {
    const last = groups[groups.length - 1];
    if (last && last[0] === it.category) last[1].push(it);
    else groups.push([it.category, [it]]);
  }
  const nextPending = c.items.find((i) => !i.completedAt);
  const existingTemplate = findTemplate(templates, c.machineCode);
  const done = doneCount(c);

  return (
    <div className="shell">
      <AppBar
        title={c.machineName}
        sub={`${c.machineCode}${c.cwo ? ` · ${c.cwo}` : ''}`}
        back="/"
        actions={
          <button className="iconbtn" aria-label="More actions" onClick={() => setMenu(true)}>
            <MoreHorizontal />
          </button>
        }
      />
      <main className="content with-bar">
        <div className="card stack">
          <div className="between">
            <div>
              <div className="eyebrow">QC checklist</div>
              <div className="tnum" style={{ font: '600 26px/1.1 var(--font-head)', marginTop: 4 }}>
                {done}
                <span className="muted" style={{ fontSize: 16 }}> / {c.items.length} done</span>
              </div>
            </div>
            <ChecklistChip c={c} />
          </div>
          <ResultBar c={c} legend />
        </div>

        <div className="filters" role="tablist" aria-label="Filter items">
          {(
            [
              ['all', `All ${c.items.length}`],
              ['pending', `Pending ${c.items.length - done}`],
              ['nok', `NOK ${c.items.filter((i) => i.completedAt && i.result === 'nok').length}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>

        {c.items.length === 0 ? (
          <Empty icon={<ClipboardList />} title="No items yet">
            <Link className="btn btn-primary" to={`/checklists/${c.id}/edit`}>
              <Pencil /> Add items
            </Link>
          </Empty>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Nothing here for this filter.
          </p>
        ) : (
          groups.map(([cat, items], gi) => (
            <section key={`${cat}-${gi}`} className="stack" style={{ gap: 6 }}>
              <div className="group-head">
                <span>{cat}</span>
                <span className="tnum">
                  {items.filter((i) => i.completedAt).length}/{items.length}
                </span>
              </div>
              <div className="list">
                {items.map((i) => {
                  const cls = i.completedAt ? i.result : 'pending';
                  return (
                    <Link key={i.id} className="li" to={`/checklists/${c.id}/items/${i.id}`}>
                      <span className="no">{i.itemNo}</span>
                      <span className="t">
                        <span>{i.procedure}</span>
                        {i.remarks ? <div className="s wrap-anywhere">“{i.remarks}”</div> : null}
                      </span>
                      <span className={`pill ${cls}`}>{i.completedAt ? PILL[i.result] : 'Pending'}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <div className="actionbar">
        <div>
          <div className="btn-row" style={{ gridTemplateColumns: nextPending && c.status === 'in_progress' ? '1.4fr 1fr' : '1fr' }}>
            {nextPending && c.status === 'in_progress' ? (
              <button className="btn btn-primary" onClick={() => nav(`/checklists/${c.id}/items/${nextPending.id}`)}>
                {done === 0 ? 'Start inspecting' : 'Continue'} <ArrowRight />
              </button>
            ) : null}
            <button className={`btn ${nextPending && c.status === 'in_progress' ? '' : 'btn-primary'}`} onClick={() => nav(`/checklists/${c.id}/export`)}>
              <Share2 /> {c.status === 'completed' ? 'Export Excel' : 'Complete'}
            </button>
          </div>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Checklist">
        <div className="list">
          <button className="li" onClick={() => nav(`/checklists/${c.id}/edit`)} disabled={c.status !== 'in_progress'}>
            <Pencil className="muted" />
            <span className="t">
              <b>Edit checklist</b>
              <div className="s">{c.status === 'in_progress' ? 'Machine details, add, remove or reorder items' : 'Reopen the checklist to edit it'}</div>
            </span>
            <span />
          </button>
          <button
            className="li"
            onClick={() => {
              setMenu(false);
              setConfirm('template');
            }}
          >
            <LayoutTemplate className="muted" />
            <span className="t">
              <b>Save as template</b>
              <div className="s">{existingTemplate ? `Replaces the template for ${c.machineCode}` : `Reuse these items for ${c.machineCode}`}</div>
            </span>
            <span />
          </button>
          <button
            className="li"
            onClick={() => {
              setMenu(false);
              setConfirm('delete');
            }}
          >
            <Trash2 style={{ color: 'var(--nok)' }} />
            <span className="t">
              <b style={{ color: 'var(--nok)' }}>Delete checklist</b>
              <div className="s">Export it first if you need the report</div>
            </span>
            <span />
          </button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirm === 'template'}
        title={existingTemplate ? 'Replace template?' : 'Save as template?'}
        body={`The ${c.items.length} items (without results) become the template for ${c.machineCode}.`}
        confirmLabel={existingTemplate ? 'Replace' : 'Save'}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const r = await saveTemplateFrom(c.id);
          toast(r === 'created' ? 'Template saved.' : 'Template replaced.', 'good');
        }}
      />
      <ConfirmSheet
        open={confirm === 'delete'}
        title="Delete this checklist?"
        body="Results and remarks on this phone are deleted. This cannot be undone."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await deleteChecklist(c.id);
          toast('Checklist deleted.');
          nav('/', { replace: true });
        }}
      />
    </div>
  );
}
