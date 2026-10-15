import { Camera, ClipboardCheck, ClipboardList, Images, Plus, TriangleAlert } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChecklistChip, EvidenceChip } from '../components/StatusChip';
import { ResultBar } from '../components/ResultBar';
import { Thumb } from '../components/Thumb';
import { TabBar } from '../components/TabBar';
import { Empty } from '../components/ui';
import { fmtSize, plural, timeAgo } from '../core/format';
import { checklistLabel, daysSince, doneCount, evidenceLabel, photoBytes, photoCount } from '../core/rules';
import { useApp } from '../data/store';

export function Home() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('m') === 'evidence' ? 'evidence' : 'checklists';
  const nav = useNavigate();
  const { checklists, evidence, settings } = useApp();

  const sortedC = [...checklists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sortedE = [...evidence].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const unexported = [
    ...checklists.filter((c) => checklistLabel(c) === 'completed').map((c) => c.updatedAt),
    ...evidence.filter((e) => evidenceLabel(e) === 'not_exported').map((e) => e.updatedAt),
  ];
  const oldest = unexported.length ? Math.max(...unexported.map((d) => daysSince(d))) : 0;
  const openChecklists = checklists.filter((c) => c.status === 'in_progress').length;
  const totalPhotos = evidence.reduce((a, e) => a + photoCount(e), 0);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const select = (m: 'checklists' | 'evidence') => setParams(m === 'evidence' ? { m } : {}, { replace: true });

  return (
    <div className="shell">
      <section className="hero">
        <div className="greet">
          <div>
            <div className="wordmark">
              GeTech <b>QC</b>
            </div>
            <h1>Hi, {settings.engineerName || 'there'}</h1>
            <div className="date">{today}</div>
          </div>
        </div>
        <div className="modules" role="tablist" aria-label="Work type">
          <button role="tab" aria-selected={mode === 'checklists'} className={`module ${mode === 'checklists' ? 'active' : ''}`} onClick={() => select('checklists')}>
            <ClipboardCheck />
            <span className="count">{checklists.length}</span>
            <span>
              <span className="name">QC checklists</span>
              <span className="hint" style={{ display: 'block' }}>
                {openChecklists} in progress
              </span>
            </span>
          </button>
          <button role="tab" aria-selected={mode === 'evidence'} className={`module ${mode === 'evidence' ? 'active' : ''}`} onClick={() => select('evidence')}>
            <Images />
            <span className="count">{evidence.length}</span>
            <span>
              <span className="name">Photo evidence</span>
              <span className="hint" style={{ display: 'block' }}>
                {plural(totalPhotos, 'photo')}
              </span>
            </span>
          </button>
        </div>
      </section>

      <main className="content">
        {unexported.length > 0 ? (
          <div className="banner" role="status">
            <TriangleAlert />
            <span>
              <b>{plural(unexported.length, 'item')} not exported</b>
              {oldest >= 3 ? `, the oldest ${oldest} days ago` : ''}. The exported file is your only backup, so export before clearing browser data.
            </span>
          </div>
        ) : null}

        {mode === 'checklists' ? (
          sortedC.length === 0 ? (
            <Empty icon={<ClipboardList />} title="No QC checklists yet">
              <p>Start one from a saved template, an Excel checklist, or build it by hand.</p>
            </Empty>
          ) : (
            sortedC.map((c) => (
              <Link key={c.id} to={`/checklists/${c.id}`} className="card card-link stack">
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <h3 style={{ fontSize: 19 }}>{c.machineName}</h3>
                    <div className="mono small muted wrap-anywhere">
                      {c.machineCode}
                      {c.cwo ? ` · ${c.cwo}` : ''}
                    </div>
                  </div>
                  <ChecklistChip c={c} />
                </div>
                <ResultBar c={c} />
                <div className="between small muted tnum">
                  <span>
                    {doneCount(c)} of {c.items.length} done
                  </span>
                  <span>Updated {timeAgo(c.updatedAt)}</span>
                </div>
              </Link>
            ))
          )
        ) : sortedE.length === 0 ? (
          <Empty icon={<Camera />} title="No photo evidence yet">
            <p>Start one per machine, take photos into categories like Safety or Functional, name each one, and export them as a zip.</p>
          </Empty>
        ) : (
          sortedE.map((e) => {
            const recent = e.categories.flatMap((c) => c.photos).slice(-4).reverse();
            return (
              <Link key={e.id} to={`/evidence/${e.id}`} className="card card-link stack">
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <h3 style={{ fontSize: 19 }}>{e.title || e.machineCode || 'Untitled evidence'}</h3>
                    <div className="mono small muted wrap-anywhere">{[e.machineCode, e.cwo].filter(Boolean).join(' · ') || 'No machine code'}</div>
                  </div>
                  <EvidenceChip e={e} />
                </div>
                {recent.length ? (
                  <div className="strip">
                    {recent.map((p) => (
                      <Thumb key={p.id} id={p.id} />
                    ))}
                  </div>
                ) : null}
                <div className="between small muted tnum">
                  <span>
                    {plural(photoCount(e), 'photo')} · {plural(e.categories.filter((c) => c.photos.length).length, 'category', 'categories')}
                  </span>
                  <span>{photoCount(e) ? fmtSize(photoBytes(e)) : `Updated ${timeAgo(e.updatedAt)}`}</span>
                </div>
              </Link>
            );
          })
        )}
      </main>

      <button className="fab" onClick={() => nav(mode === 'checklists' ? '/checklists/new' : '/evidence/new')}>
        <Plus />
        {mode === 'checklists' ? 'New checklist' : 'New photo evidence'}
      </button>
      <TabBar />
    </div>
  );
}
