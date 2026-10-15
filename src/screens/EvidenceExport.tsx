import { Download, FileArchive, Loader2, Share2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { EvidenceChip } from '../components/StatusChip';
import { AppBar, toast } from '../components/ui';
import { evidencePhotoCount, isMissing, itemName, itemPath, setTitle, zipBaseName, zipClashes, zipEntries } from '../core/evidence';
import { fmtDateTime, fmtSize, plural } from '../core/format';
import { nowISO } from '../core/ids';
import { treeLines } from '../core/tree';
import { getPhoto } from '../data/db';
import { useApp } from '../data/store';
import { buildEvidencePack, type EvidencePack } from '../export/evidencePack';
import { canShareFiles, downloadBlob, shareFiles, toFile } from '../export/share';

export function EvidenceExport() {
  const { id = '' } = useParams();
  const { evidence, settings, updateEvidence } = useApp();
  const e = evidence.find((x) => x.id === id);
  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [progress, setProgress] = useState('Preparing…');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const clashes = e ? zipClashes(e) : [];
  const blocked = clashes.length > 0;

  // Build the zip as soon as the screen opens, so Share can run straight from the tap.
  const version = e?.updatedAt;
  useEffect(() => {
    if (!e || !evidencePhotoCount(e) || blocked) return;
    let alive = true;
    setPack(null);
    setError(null);
    setSaved(new Set());
    buildEvidencePack(e, getPhoto, settings.splitMB, (m) => alive && setProgress(m))
      .then((p) => alive && setPack(p))
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version, settings.splitMB, blocked]);

  if (!e) return <Navigate to="/" replace />;
  const n = evidencePhotoCount(e);
  const missing = e.folders.map((f) => ({ f, items: f.items.filter(isMissing) })).filter((x) => x.items.length);
  const missingCount = missing.reduce((a, x) => a + x.items.length, 0);
  const zipFiles = pack ? pack.parts.map((p) => toFile(p.blob, p.name, 'application/zip')) : [];
  const shareable = zipFiles.length > 0 && canShareFiles(zipFiles);
  const markExported = () => updateEvidence(e.id, (d) => void (d.exportedAt = nowISO()), { touch: false });

  async function onShare() {
    const r = await shareFiles(zipFiles, `${setTitle(e!)} photos`);
    if (r === 'shared') {
      await markExported();
      toast('Shared. Marked as exported.', 'good');
    } else if (r === 'failed') toast('Sharing failed. Use Download instead.', 'bad');
  }
  async function onDownload(i: number) {
    if (!pack) return;
    const part = pack.parts[i];
    downloadBlob(part.blob, part.name);
    const next = new Set(saved).add(part.name);
    setSaved(next);
    if (next.size === pack.parts.length) {
      await markExported();
      toast(pack.parts.length > 1 ? 'All parts downloaded. Marked as exported.' : 'Downloaded. Marked as exported.', 'good');
    }
  }

  return (
    <div className="shell">
      <AppBar title="Export photos" sub={setTitle(e)} back={`/evidence/${e.id}`} />
      <main className="content">
        {missingCount ? (
          <details className="banner missing">
            <summary>
              <TriangleAlert />
              <span>
                <b>{plural(missingCount, 'photo')} not taken yet.</b> You can still export; tap to see which.
              </span>
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              {missing.map(({ f, items }) => (
                <div key={f.id}>
                  <Link to={`/evidence/${e.id}/f/${f.id}`}>
                    <b>{f.name}</b> · {items.length}
                  </Link>
                  <ul className="small">
                    {items.map((i) => (
                      <li key={i.id} className="wrap-anywhere">
                        {[...itemPath(i, e.ft), itemName(i, e.ft)].join(' › ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {blocked ? (
          <div className="banner bad">
            <TriangleAlert />
            <span>
              <b>Two photos would get the same file name:</b> {clashes.join(', ')}. Remove or rename the photo added on site, then export.
            </span>
          </div>
        ) : (
          <section className="card stack">
            {error ? (
              <div className="banner bad">Could not build the zip: {error}</div>
            ) : !n ? (
              <p className="muted">No photos yet.</p>
            ) : !pack ? (
              <div className="row muted">
                <Loader2 className="spin" /> {progress}
              </div>
            ) : (
              <>
                <b>
                  {pack.parts.length > 1 ? `${pack.parts.length} zip parts` : 'Zip ready'} · {fmtSize(pack.totalBytes)}
                </b>
                {pack.parts.length > 1 ? <p className="hint">Send every part.</p> : null}
                <div className="filelist">
                  {pack.parts.map((p, i) => (
                    <div key={p.name}>
                      <span className="row grow" style={{ alignItems: 'flex-start' }}>
                        <FileArchive size={18} className="muted" style={{ flex: 'none', marginTop: 2 }} />
                        <span className="mono wrap-anywhere">{p.name}</span>
                      </span>
                      <span className="row" style={{ flex: 'none' }}>
                        <span className="muted tnum">{fmtSize(p.size)}</span>
                        {pack.parts.length > 1 ? (
                          <button className="btn btn-sm" onClick={() => void onDownload(i)} aria-label={`Download ${p.name}`}>
                            <Download />
                          </button>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
                {shareable ? (
                  <button className="btn btn-primary btn-block" onClick={onShare}>
                    <Share2 /> Share to WhatsApp, Drive, Files…
                  </button>
                ) : null}
                {pack.parts.length === 1 ? (
                  <button className={`btn btn-block ${shareable ? '' : 'btn-primary'}`} onClick={() => void onDownload(0)}>
                    <Download /> Download zip
                  </button>
                ) : null}
                {e.exportedAt ? <div className="tiny muted">Last exported {fmtDateTime(e.exportedAt)}</div> : null}
              </>
            )}
          </section>
        )}

        <section className="card stack">
          <div className="between">
            <b>{plural(n, 'photo')}</b>
            <EvidenceChip e={e} />
          </div>
          <div className="eyebrow">Inside {zipBaseName(e)}.zip</div>
          <div className="tree">{treeLines(zipEntries(e).map((z) => z.path)).join('\n') || 'No photos yet.'}</div>
        </section>
      </main>
    </div>
  );
}
