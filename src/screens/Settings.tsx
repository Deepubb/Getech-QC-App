import { HardDrive, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TabBar } from '../components/TabBar';
import { AppBar, ConfirmSheet, Field, toast } from '../components/ui';
import { safeName } from '../core/evidence';
import { fmtSize } from '../core/format';
import type { ThemeChoice } from '../core/types';
import { useApp } from '../data/store';

export function Settings() {
  const { settings, saveSettings, wipeAll, checklists, evidence } = useApp();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [wipe, setWipe] = useState(false);
  const [newCat, setNewCat] = useState('');
  const cats = settings.defaultCategories;
  const addCat = () => {
    const n = safeName(newCat);
    if (!n) return;
    if (cats.some((c) => c.toLowerCase() === n.toLowerCase())) return toast(`${n} is already in the list.`, 'bad');
    void saveSettings({ defaultCategories: [...cats, n] });
    setNewCat('');
  };

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
  }, [checklists.length, evidence.length]);

  const pct = estimate && estimate.quota ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  return (
    <div className="shell">
      <AppBar title="Settings" back={false} />
      <main className="content">
        <section className="card stack">
          <Field label="Your name" hint="Shown on new checklists and photo evidence.">
            <input defaultValue={settings.engineerName} onBlur={(e) => e.target.value.trim() && void saveSettings({ engineerName: e.target.value.trim() })} />
          </Field>
          <Field label="Split photo zips larger than" hint="90 MB keeps each part under WhatsApp's document limit of about 100 MB.">
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
          <b>Default photo categories</b>
          <p className="hint">New photo evidence starts with these folders, unless the machine has its own template.</p>
          <div className="cats">
            {cats.map((c) => (
              <span key={c} className="cat-chip">
                {c}
                <button aria-label={`Remove ${c}`} onClick={() => void saveSettings({ defaultCategories: cats.filter((x) => x !== c) })}>
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
            <input className="input grow" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add a category" aria-label="New default category" />
            <button className="btn" type="submit" disabled={!safeName(newCat)}>
              <Plus /> Add
            </button>
          </form>
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
            <dt>Sign-in</dt>
            <dd>None. Your phone lock protects the data.</dd>
            <dt>Where data lives</dt>
            <dd>Only on this phone</dd>
          </dl>
          <button className="btn btn-danger" onClick={() => setWipe(true)}>
            <Trash2 /> Delete all data on this phone
          </button>
        </section>
      </main>
      <TabBar />
      <ConfirmSheet
        open={wipe}
        title="Delete all data?"
        body="Every checklist, photo, template and shot list on this phone is deleted. Export anything you need first. This cannot be undone."
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
