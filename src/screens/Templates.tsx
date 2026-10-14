import { Camera, ClipboardCheck, LayoutTemplate, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabBar } from '../components/TabBar';
import { AppBar, ConfirmSheet, Empty, toast } from '../components/ui';
import { fmtDate, plural } from '../core/format';
import { useApp } from '../data/store';

export function Templates() {
  const nav = useNavigate();
  const { templates, shotlists, setDraft, deleteTemplate, deleteShotList } = useApp();
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
                      setDraft({ source: 'template', machine: { machineName: t.machineName, machineCode: t.machineCode, customer: t.customer, cwo: '' }, items: t.items, photoNames: [], errors: [], warnings: [], categoryCount: new Set(t.items.map((i) => i.category)).size });
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
          <h2>Photo shot lists</h2>
        </div>
        {shotlists.length === 0 ? (
          <div className="card flat">
            <Empty icon={<Camera />} title="No shot lists">
              <p>In photo evidence, name your shots and choose Save names for next time.</p>
            </Empty>
          </div>
        ) : (
          [...shotlists]
            .sort((a, b) => a.machineCode.localeCompare(b.machineCode))
            .map((l) => (
              <div key={l.id} className="card stack">
                <div className="between">
                  <h3 className="mono" style={{ fontSize: 17 }}>
                    {l.machineCode}
                  </h3>
                  <span className="chip">{plural(l.names.length, 'name')}</span>
                </div>
                <div className="mono tiny muted wrap-anywhere">{l.names.join(' · ')}</div>
                <div className="btn-row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <button className="btn btn-primary" onClick={() => nav(`/evidence/new?list=${l.id}`)}>
                    <Camera /> Start photo evidence
                  </button>
                  <button className="btn btn-danger" aria-label={`Delete shot list ${l.machineCode}`} onClick={() => setRemoving({ kind: 'list', id: l.id, label: l.machineCode })}>
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))
        )}
      </main>
      <TabBar />
      <ConfirmSheet
        open={!!removing}
        title={removing?.kind === 'template' ? `Delete template ${removing?.label}?` : `Delete shot list ${removing?.label}?`}
        body="Work you already started is not affected."
        confirmLabel="Delete"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          if (removing.kind === 'template') await deleteTemplate(removing.id);
          else await deleteShotList(removing.id);
          toast('Deleted.');
        }}
      />
    </div>
  );
}
