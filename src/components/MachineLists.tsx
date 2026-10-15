import { FileSpreadsheet, Loader2, RefreshCw, Trash2, TriangleAlert, Upload, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { fmtDate, fmtDateTime, plural } from '../core/format';
import { diffLists, shotCount, usesFixture, type ParsedList } from '../core/masterList';
import type { PublishError } from '../data/remote';
import { useApp } from '../data/store';
import { ConfirmSheet, Sheet, toast } from './ui';

interface Upload {
  file: string;
  lists: ParsedList[];
  skipped: string[];
  mode: 'team' | 'phone';
}

/** Settings section: the team master list and the machines this phone knows. */
export function MachineLists() {
  const { masterLists, team, saveMasterLists, deleteMasterList, syncTeam, publishTeam } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const mode = useRef<Upload['mode']>('team');
  const [reading, setReading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const sorted = [...masterLists].sort((a, b) => a.machine.localeCompare(b.machine));
  const toRemove = masterLists.find((l) => l.id === remove);

  const pick = (m: Upload['mode']) => {
    mode.current = m;
    input.current?.click();
  };

  async function read(file: File) {
    setReading(true);
    try {
      const { readMasterWorkbook } = await import('../core/readWorkbook');
      const r = readMasterWorkbook(await file.arrayBuffer());
      if (!r.lists.length) toast('No sheet in that file has folder headings with photo names below them.', 'bad');
      else setUpload({ file: file.name, mode: mode.current, ...r });
    } catch {
      toast('That file could not be read. Save it as .xlsx and try again.', 'bad');
    } finally {
      setReading(false);
    }
  }

  async function checkNow() {
    setChecking(true);
    const message = await syncTeam();
    setChecking(false);
    toast(message ?? (team ? 'You have the latest master list.' : 'No team master list found yet.'), message ? 'good' : 'info');
  }

  return (
    <section className="card stack">
      <div className="row">
        <FileSpreadsheet className="muted" />
        <b>Machines</b>
      </div>

      <div className="banner info">
        <Users />
        <span className="stack" style={{ gap: 6 }}>
          {team ? (
            <span>
              <b>Team master list</b> published {fmtDateTime(team.publishedAt)}
              {team.publishedBy ? ` by ${team.publishedBy}` : ''}. Phones pick up a newer one when the app opens.
            </span>
          ) : (
            <span>
              <b>No team master list yet.</b> Publish the master Excel from a PC and every phone picks it up when the app opens.
            </span>
          )}
          <span>
            <button className="btn btn-sm" disabled={checking} onClick={() => void checkNow()}>
              {checking ? <Loader2 className="spin" /> : <RefreshCw />} Check now
            </button>
          </span>
        </span>
      </div>

      {sorted.length ? (
        <div className="list">
          {sorted.map((l) => (
            <div key={l.id} className="li">
              <FileSpreadsheet className="muted" />
              <span className="t">
                <b>{l.machine}</b>
                <div className="s">
                  {plural(l.folders.length, 'folder')} · {plural(shotCount(l), 'photo')}
                  {usesFixture(l) ? ' · uses FT number' : ''}
                </div>
                <div className="s wrap-anywhere">
                  {l.source} · {fmtDate(l.updatedAt)}
                </div>
              </span>
              <button className="iconbtn" aria-label={`Delete ${l.machine}`} onClick={() => setRemove(l.id)}>
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <p className="hint">
        Each sheet of the master Excel is one machine, named after the sheet. Row 1 holds the main folders; every name below is a photo. &ldquo;EPSON &gt; Loader
        Robot&rdquo; puts the photo in an EPSON subfolder.
      </p>
      <button className="btn btn-primary btn-block" disabled={reading} onClick={() => pick('team')}>
        {reading ? <Loader2 className="spin" /> : <Upload />}
        Publish master Excel to the team
      </button>
      <button className="btn btn-ghost btn-sm" disabled={reading} onClick={() => pick('phone')}>
        Use a file on this phone only
      </button>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        hidden
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = '';
          if (f) void read(f);
        }}
      />

      {upload ? (
        <UploadSheet
          upload={upload}
          onClose={() => setUpload(null)}
          onPhone={async () => {
            await saveMasterLists(upload.lists, upload.file);
            toast(`${plural(upload.lists.length, 'machine')} saved on this phone. The next team update replaces them.`, 'good');
            setUpload(null);
          }}
          onPublish={async () => {
            const r = await publishTeam(upload.lists, upload.file);
            if (r.ok) {
              toast(r.message, 'good');
              setUpload(null);
              return null;
            }
            return publishMessage(r);
          }}
        />
      ) : null}

      <ConfirmSheet
        open={!!toRemove}
        title={`Delete ${toRemove?.machine ?? 'machine'}?`}
        body="Its list is removed from this phone until the next team update. Photo evidence already started for it stays."
        confirmLabel="Delete"
        danger
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          if (toRemove) await deleteMasterList(toRemove.id);
          toast('Machine deleted.');
        }}
      />
    </section>
  );
}

function UploadSheet({
  upload,
  onClose,
  onPhone,
  onPublish,
}: {
  upload: Upload;
  onClose: () => void;
  onPhone: () => Promise<void>;
  onPublish: () => Promise<string | null>;
}) {
  const masterLists = useApp((s) => s.masterLists);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = upload.mode === 'team';
  const dropped = team ? masterLists.filter((m) => !upload.lists.some((l) => l.machine.toLowerCase() === m.machine.toLowerCase())) : [];

  async function publish() {
    setBusy(true);
    setError(null);
    setError(await onPublish());
    setBusy(false);
  }

  return (
    <Sheet open onClose={onClose} title={team ? 'Publish to the team' : 'Use on this phone'}>
      <div className="tiny muted mono wrap-anywhere">{upload.file}</div>
      <div className="list">
        {upload.lists.map((l) => {
          const existing = masterLists.find((x) => x.machine.toLowerCase() === l.machine.toLowerCase());
          const d = existing ? diffLists(existing, l) : null;
          return (
            <div key={l.machine} className="li" style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="t">
                <b>{l.machine}</b>
                <div className="s">{l.folders.map((f) => `${f.name} ${f.shots.length}`).join(' · ')}</div>
                {usesFixture(l) ? <div className="s">Uses {'{fixture}'}: filled from the FT number when you start.</div> : null}
              </span>
              {!d ? (
                <span className="chip ok">New</span>
              ) : d.added || d.removed ? (
                <span className="chip warn">
                  +{d.added} −{d.removed}
                </span>
              ) : (
                <span className="chip">No change</span>
              )}
            </div>
          );
        })}
        {dropped.map((m) => (
          <div key={m.id} className="li" style={{ gridTemplateColumns: '1fr auto' }}>
            <span className="t">
              <b>{m.machine}</b>
              <div className="s">Not in this file, so it is removed for everyone.</div>
            </span>
            <span className="chip nok">Removed</span>
          </div>
        ))}
      </div>
      {upload.lists.some((l) => l.warnings.length) || upload.skipped.length ? (
        <div className="banner">
          <TriangleAlert />
          <span className="stack" style={{ gap: 4 }}>
            {upload.lists.flatMap((l) => l.warnings.map((w) => `${l.machine}: ${w}`)).map((w) => (
              <span key={w}>{w}</span>
            ))}
            {upload.skipped.length ? <span>Sheets with nothing to use: {upload.skipped.join(', ')}.</span> : null}
          </span>
        </div>
      ) : null}
      <p className="hint">Photo evidence already started keeps its names until someone taps Apply new names on that machine.</p>

      {team ? (
        <>
          {error ? <p className="hint bad">{error}</p> : null}
          <button className="btn btn-primary btn-block" disabled={busy} onClick={() => void publish()}>
            {busy ? <Loader2 className="spin" /> : <Upload />} Publish {plural(upload.lists.length, 'machine')} to everyone
          </button>
        </>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => void onPhone()}>
          Save {plural(upload.lists.length, 'machine')} on this phone
        </button>
      )}
    </Sheet>
  );
}

function publishMessage(r: { error: PublishError; missing?: string[] }): string {
  switch (r.error) {
    case 'no_server':
      return 'Cloudflare is serving the app but not its server script. Check that the latest build in Cloudflare → Deployments finished.';
    case 'not_set_up': {
      const parts = (r.missing ?? []).map((m) =>
        m === 'MASTER' ? 'the storage (KV binding MASTER)' : m,
      );
      return `Cloudflare is missing ${parts.join(' and ') || 'part of its set-up'}.`;
    }
    case 'offline':
      return 'No connection. Try again when you are online.';
    default:
      return 'Publishing failed. Try again.';
  }
}
