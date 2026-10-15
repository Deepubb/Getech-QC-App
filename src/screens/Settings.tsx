import { Copy, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MachineLists } from '../components/MachineLists';
import { TabBar } from '../components/TabBar';
import { AppBar, ConfirmSheet, Field, toast } from '../components/ui';
import { fmtSize } from '../core/format';
import type { ThemeChoice } from '../core/types';
import { clearProblems, readProblems } from '../data/problemLog';
import { useApp } from '../data/store';

export function Settings() {
  const { settings, saveSettings, wipeAll, evidence } = useApp();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [wipe, setWipe] = useState(false);
  const [problems, setProblems] = useState(readProblems);

  async function refresh() {
    try {
      const e = await navigator.storage?.estimate?.();
      if (e) setEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
      setPersisted((await navigator.storage?.persisted?.()) ?? null);
    } catch {
      /* not supported */
    }
  }
  useEffect(() => {
    void refresh();
  }, [evidence.length]);

  const pct = estimate && estimate.quota ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  return (
    <div className="shell">
      <AppBar title="Settings" back={false} />
      <main className="content">
        <MachineLists />

        <section className="card stack">
          <Field label="Your name">
            <input defaultValue={settings.engineerName} onBlur={(e) => e.target.value.trim() && void saveSettings({ engineerName: e.target.value.trim() })} />
          </Field>
          <Field label="Split photo zips larger than">
            <select value={String(settings.splitMB)} onChange={(e) => void saveSettings({ splitMB: Number(e.target.value) })}>
              {[25, 50, 90, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n} MB
                </option>
              ))}
            </select>
          </Field>
          <Field label="Appearance">
            <select value={settings.theme} onChange={(e) => void saveSettings({ theme: e.target.value as ThemeChoice })}>
              <option value="system">Same as the phone</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
        </section>

        <section className="card stack">
          <div className="row">
            <HardDrive className="muted" />
            <b>Storage on this phone</b>
          </div>
          {estimate ? (
            <>
              <div className="storage-meter" role="img" aria-label={`${Math.round(pct)} percent used`}>
                <i style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
              <div className="small muted tnum">
                {fmtSize(estimate.usage)} used of about {fmtSize(estimate.quota)} the browser allows
              </div>
            </>
          ) : (
            <div className="small muted">This browser does not report storage use.</div>
          )}
          <div className="row small">
            <ShieldCheck style={{ color: persisted ? 'var(--ok)' : 'var(--warn)' }} />
            <span>{persisted ? 'The browser will keep your data.' : 'The browser may clear your data when space runs low. Install the app and export often.'}</span>
          </div>
          {!persisted && navigator.storage?.persist ? (
            <button
              className="btn btn-sm"
              onClick={async () => {
                const ok = await navigator.storage.persist().catch(() => false);
                toast(ok ? 'The browser will keep your data.' : 'The browser said no. Installing the app usually helps.', ok ? 'good' : 'info');
                void refresh();
              }}
            >
              Ask the browser to keep my data
            </button>
          ) : null}
        </section>

        <section className="card stack">
          <b>About</b>
          <dl className="kv">
            <dt>Version</dt>
            <dd className="mono">{__APP_VERSION__}</dd>
            <dt>Build</dt>
            <dd className="mono">{__APP_BUILD__}</dd>
            <dt>Sign-in</dt>
            <dd>None. Your phone lock protects the data.</dd>
            <dt>Where data lives</dt>
            <dd>Only on this phone</dd>
          </dl>
          <div className="stack" style={{ gap: 8 }}>
            <b className="small">Problem log</b>
            {problems.length ? (
              <>
                <pre className="tree" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {problems
                    .slice()
                    .reverse()
                    .map((p) => `${p.at.slice(0, 19).replace('T', ' ')}  ${p.path}\n${p.message}`)
                    .join('\n\n')}
                </pre>
                <div className="row">
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      const text = [`Build ${__APP_BUILD__}`, navigator.userAgent, ...problems.map((p) => `${p.at} ${p.path} ${p.message}`)].join('\n');
                      try {
                        await navigator.clipboard.writeText(text);
                        toast('Problem log copied.', 'good');
                      } catch {
                        toast('Could not copy. Take a screenshot instead.', 'bad');
                      }
                    }}
                  >
                    <Copy /> Copy
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      clearProblems();
                      setProblems([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <p className="small muted">No problems recorded on this phone.</p>
            )}
          </div>
          <button className="btn btn-danger" onClick={() => setWipe(true)}>
            <Trash2 /> Delete all data on this phone
          </button>
        </section>
      </main>
      <TabBar />
      <ConfirmSheet
        open={wipe}
        title="Delete all data?"
        body="All photo evidence on this phone is deleted. Your machine lists stay. Export anything you need first. This cannot be undone."
        confirmLabel="Delete everything"
        danger
        onClose={() => setWipe(false)}
        onConfirm={async () => {
          await wipeAll();
          toast('All data deleted.');
        }}
      />
    </div>
  );
}
