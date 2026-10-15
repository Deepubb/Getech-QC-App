import { Camera, FileSpreadsheet, Plus, TriangleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { EvidenceChip } from '../components/StatusChip';
import { TabBar } from '../components/TabBar';
import { Thumb } from '../components/Thumb';
import { Empty } from '../components/ui';
import { allItems, evidenceBytes, evidencePhotoCount, evidenceProgress, setTitle } from '../core/evidence';
import { fmtSize, plural, timeAgo } from '../core/format';
import { daysSince, evidenceLabel } from '../core/rules';
import { useApp } from '../data/store';

export function Home() {
  const nav = useNavigate();
  const { evidence, masterLists, settings } = useApp();
  const sorted = [...evidence].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const unexported = evidence.filter((e) => evidenceLabel(e) === 'not_exported');
  const oldest = unexported.length ? Math.max(...unexported.map((e) => daysSince(e.updatedAt))) : 0;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="shell">
      <section className="hero">
        <div className="greet">
          <div>
            <div className="wordmark">
              GeTech <b>QC</b> · Photo evidence
            </div>
            <h1>Hi, {settings.engineerName || 'there'}</h1>
            <div className="date">{today}</div>
          </div>
        </div>
      </section>

      <main className="content">
        {unexported.length > 0 ? (
          <div className="banner" role="status">
            <TriangleAlert />
            <span>
              <b>{plural(unexported.length, 'machine')} not exported</b>
              {oldest >= 3 ? `, the oldest ${oldest} days ago` : ''}. The exported zip is your only backup, so export before clearing browser data.
            </span>
          </div>
        ) : null}

        {!sorted.length && !masterLists.length ? (
          <Empty icon={<FileSpreadsheet />} title="No machine lists yet">
            <Link className="btn btn-primary" to="/settings">
              Go to Settings
            </Link>
          </Empty>
        ) : !sorted.length ? (
          <Empty icon={<Camera />} title="No photo evidence yet" />
        ) : (
          sorted.map((e) => {
            const p = evidenceProgress(e);
            const n = evidencePhotoCount(e);
            const recent = allItems(e).flatMap((i) => i.photos).sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 5);
            return (
              <Link key={e.id} to={`/evidence/${e.id}`} className="card card-link stack">
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <h3 style={{ fontSize: 19 }} className="wrap-anywhere">{setTitle(e)}</h3>
                    <div className="small muted">{e.machine}</div>
                  </div>
                  <EvidenceChip e={e} />
                </div>
                <ProgressBar p={p} />
                {recent.length ? (
                  <div className="strip">
                    {recent.map((ph) => (
                      <Thumb key={ph.id} id={ph.id} />
                    ))}
                  </div>
                ) : null}
                <div className="between small muted tnum">
                  <span>{p.total ? `${p.taken} of ${p.total} taken${p.missing ? '' : ' · done'}` : plural(n, 'photo')}</span>
                  <span>{n ? fmtSize(evidenceBytes(e)) : `Started ${timeAgo(e.createdAt)}`}</span>
                </div>
              </Link>
            );
          })
        )}
      </main>

      <button className="fab" onClick={() => nav('/evidence/new')}>
        <Plus />
        New photo evidence
      </button>
      <TabBar />
    </div>
  );
}
