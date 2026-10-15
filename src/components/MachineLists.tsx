import { FileSpreadsheet, Loader2, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { fmtDate, plural } from '../core/format';
import { diffLists, shotCount, usesFixture, type ParsedList } from '../core/masterList';
import { useApp } from '../data/store';
import { ConfirmSheet, Sheet, toast } from './ui';

interface Upload {
  file: string;
  lists: ParsedList[];
  skipped: string[];
}

/** Settings section: the machines this phone knows, each from one sheet of a master Excel. */
export function MachineLists() {
  const { masterLists, saveMasterLists, deleteMasterList } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const sorted = [...masterLists].sort((a, b) => a.machine.localeCompare(b.machine));
  const toRemove = masterLists.find((l) => l.id === remove);

  async function read(file: File) {
    setReading(true);
    try {
      const { readMasterWorkbook } = await import('../core/readWorkbook');
      const r = readMasterWorkbook(await file.arrayBuffer());
      if (!r.lists.length) toast('No sheet in that file has folder headings with photo names below them.', 'bad');
      else setUpload({ file: file.name, ...r });
    } catch {
      toast('That file could not be read. Save it as .xlsx and try again.', 'bad');
    } finally {
      setReading(false);
    }
  }

  return (
    <section className="card stack">
      <div className="row">
        <FileSpreadsheet className="muted" />
        <b>Machines</b>
      </div>
      <p className="hint">
        Each sheet of the master Excel is one machine, named after the sheet. Row 1 holds the main folders; every name below is a photo. &ldquo;EPSON &gt; Loader
        Robot&rdquo; puts the photo in an EPSON subfolder.
      </p>
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
      <button className="btn btn-primary btn-block" disabled={reading} onClick={() => input.current?.click()}>
        {reading ? <Loader2 className="spin" /> : <Upload />}
        {sorted.length ? 'Add or update machines (Excel)' : 'Upload master Excel'}
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
        <Sheet open onClose={() => setUpload(null)} title={plural(upload.lists.length, 'machine') + ' found'}>
          <div className="tiny muted mono wrap-anywhere">{upload.file}</div>
          <div className="list">
            {upload.lists.map((l) => {
              const existing = masterLists.find((x) => x.machine.toLowerCase() === l.machine.toLowerCase());
              const d = existing ? diffLists(existing, l) : null;
              return (
                <div key={l.machine} className="li" style={{ gridTemplateColumns: '1fr auto' }}>
                  <span className="t">
                    <b>{l.machine}</b>
                    <div className="s">
                      {l.folders.map((f) => `${f.name} ${f.shots.length}`).join(' · ')}
                    </div>
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
          <p className="hint">Photo evidence already started keeps the list it started with.</p>
          <button
            className="btn btn-primary btn-block"
            onClick={async () => {
              await saveMasterLists(upload.lists, upload.file);
              toast(`${plural(upload.lists.length, 'machine')} saved.`, 'good');
              setUpload(null);
            }}
          >
            Save {plural(upload.lists.length, 'machine')}
          </button>
        </Sheet>
      ) : null}

      <ConfirmSheet
        open={!!toRemove}
        title={`Delete ${toRemove?.machine ?? 'machine'}?`}
        body="Its list is removed from this phone. Photo evidence already started for it stays."
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
