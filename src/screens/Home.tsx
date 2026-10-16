import { Camera, Clock, FileSpreadsheet, HardDrive, Images, Plus, TriangleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/getech-logo.png';
import { ProgressBar } from '../components/ProgressBar';
import { EvidenceChip } from '../components/StatusChip';
import { TabBar } from '../components/TabBar';
import { Empty } from '../components/ui';
import { evidenceBytes, evidencePhotoCount, evidenceProgress, setTitle } from '../core/evidence';
import { fmtSize, plural, timeAgo } from '../core/format';
import { daysSince, evidenceLabel } from '../core/rules';
import { useApp } from '../data/store';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'QC';

export function Home() {
  const nav = useNavigate();
  const { evidence, masterLists, settings } = useApp();
  const sorted = [...evidence].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const unexported = evidence.filter((e) => evidenceLabel(e) === 'not_exported');
  const oldest = unexported.length ? Math.max(...unexported.map((e) => daysSince(e.updatedAt))) : 0;
  const photos = evidence.reduce((a, e) => a + evidencePhotoCount(e), 0);
  const now = new Date();
  const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const name = settings.engineerName.trim();

  return (
    <div className="shell">
      <header className="home-top">
        <div>
          <span className="home-logo">
            <img src={logo} alt="GeTech" width={528} height={146} />
          </span>
          <span className="row" style={{ gap: 12 }}>
            <span className="home-app">QC Evidence</span>
            <Link to="/settings" className="avatar" aria-label="Settings">
              {initials(name)}
            </Link>
          </span>
        </div>
      </header>

      <main className="content">
        <section className="overview" aria-label="Overview">
          <div>
            <div className="date">{today}</div>
            <h1>
              {greeting(now.getHours())}
              {name ? `, ${name.split(/\s+/)[0]}` : ''}
            </h1>
          </div>
          <div className="stats">
            <div>
              <b>{evidence.length}</b>
              <span>{evidence.length === 1 ? 'Machine' : 'Machines'}</span>
            </div>
            <div>
              <b>{photos}</b>
              <span>Photos taken</span>
            </div>
            <div>
              <b className={unexported.length ? 'hot' : ''}>{unexported.length}</b>
              <span>Not exported</span>
            </div>
          </div>
        </section>

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
          <>
            <div className="list-head">
              <h2>Machines</h2>
              <span>{sorted.length}</span>
            </div>
            {sorted.map((e) => {
              const p = evidenceProgress(e);
              const n = evidencePhotoCount(e);
              const pct = p.total ? Math.round(((p.taken + p.na) / p.total) * 100) : n ? 100 : 0;
              const state = !n ? 'idle' : p.missing ? '' : 'done';
              return (
                <Link key={e.id} to={`/evidence/${e.id}`} className={`card card-link mcard ${state}`}>
                  <div className="between" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="type">{e.machine}</div>
                      <h3 className="wrap-anywhere">{setTitle(e)}</h3>
                    </div>
                    <EvidenceChip e={e} />
                  </div>
                  <div className="bar">
                    <ProgressBar p={p} />
                    <span className="pct">{pct}%</span>
                  </div>
                  <div className="meta tnum">
                    <span>
                      <Images />
                      {p.total ? `${p.taken} / ${p.total} taken` : plural(n, 'photo')}
                    </span>
                    {n ? (
                      <span>
                        <HardDrive />
                        {fmtSize(evidenceBytes(e))}
                      </span>
                    ) : null}
                    <span>
                      <Clock />
                      {timeAgo(e.updatedAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </>
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
