import { Camera, ClipboardCheck, LayoutTemplate, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabBar } from '../components/TabBar';
import { AppBar, ConfirmSheet, Empty, toast } from '../components/ui';
import { fmtDate, plural } from '../core/format';
import { useApp } from '../data/store';

export function Templates() {
  const nav = useNavigate();
  const { templates, photoTemplates, setDraft, deleteTemplate, deletePhotoTemplate } = useApp();
  const [removing, setRemoving] = useState<{ kind: 'template' | 'list'; id: string; label: string } | null>(null);

  return (
    <div className="shell">
      <AppBar title="Templates" back={false} />
      <main className="content">
        <div className="section-title">
          <h2>QC checklist templates</h2>
        </div>
        {templates.length === 0 ? (
          <div className="card flat">
            <Empty icon={<LayoutTemplate />} title="No checklist templates">
              <p>Open a checklist and choose Save as template to reuse its items.</p>
            </Empty>
          </div>
        ) : (
          [...templates]
            .sort((a, b) => a.machineCode.localeCompare(b.machineCode))
            .map((t) => (
              <div key={t.id} className="card stack">
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <h3 style={{ fontSize: 18 }}>{t.machineName}</h3>
                    <div className="mono small muted">
                      {t.machineCode}
                      {t.version ? ` · ${t.version}` : ''}
                    </div>
                  </div>
                  <span className="chip">{plural(t.items.length, 'item')}</span>
                </div>
                <div className="tiny muted">Updated {fmtDate(t.updatedAt)}</div>
                <div className="btn-row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setDraft({ source: 'template', machine: { machineName: t.machineName, machineCode: t.machineCode, customer: t.customer, cwo: '' }, items: t.items, photoPlan: [], errors: [], warnings: [], categoryCount: new Set(t.items.map((i) => i.category)).size });
                      nav('/checklists/new/details');
                    }}
                  >
                    <ClipboardCheck /> Start checklist
                  </button>
                  <button className="btn btn-danger" aria-label={`Delete template ${t.machineCode}`} onClick={() => setRemoving({ kind: 'template', id: t.id, label: t.machineCode })}>
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))
        )}

        <div className="section-title">
          <h2>Photo evidence templates</h2>
        </div>
        {photoTemplates.length === 0 ? (
          <div className="card flat">
            <Empty icon={<Camera />} title="No photo templates">
              <p>In photo evidence for a machine, open the menu and choose Save as template for next time.</p>
            </Empty>
          </div>
        ) : (
          [...photoTemplates]
            .sort((a, b) => a.machineCode.localeCompare(b.machineCode))
            .map((l) => {
              const total = l.categories.reduce((a, c) => a + c.names.length, 0);
              return (
                <div key={l.id} className="card stack">
                  <div className="between">
                    <h3 className="mono" style={{ fontSize: 17 }}>
                      {l.machineCode}
                    </h3>
                    <span className="chip">{plural(total, 'photo name')}</span>
                  </div>
                  <div className="stack" style={{ gap: 4 }}>
                    {l.categories.map((c) => (
                      <div key={c.name} className="small wrap-anywhere">
                        <b>{c.name}</b>
                        <span className="muted">{c.names.length ? ` · ${c.names.join(', ')}` : ' · no names yet'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="btn-row" style={{ gridTemplateColumns: '1fr auto' }}>
                    <button className="btn btn-primary" onClick={() => nav(`/evidence/new?template=${l.id}`)}>
                      <Camera /> Start photo evidence
                    </button>
                    <button className="btn btn-danger" aria-label={`Delete photo template ${l.machineCode}`} onClick={() => setRemoving({ kind: 'list', id: l.id, label: l.machineCode })}>
                      <Trash2 />
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </main>
      <TabBar />
      <ConfirmSheet
        open={!!removing}
        title={removing?.kind === 'template' ? `Delete checklist template ${removing?.label}?` : `Delete photo template ${removing?.label}?`}
        body="Work you already started is not affected."
        confirmLabel="Delete"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          if (removing.kind === 'template') await deleteTemplate(removing.id);
          else await deletePhotoTemplate(removing.id);
          toast('Deleted.');
        }}
      />
    </div>
  );
}
