import { Download, FileArchive, Loader2, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { EvidenceChip } from '../components/StatusChip';
import { AppBar, toast } from '../components/ui';
import { fmtDateTime, fmtSize, plural } from '../core/format';
import { nowISO } from '../core/ids';
import { evidenceFiles, evidenceZipPrefix } from '../core/names';
import { photoCount } from '../core/rules';
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

  // Build the zip as soon as the screen opens, so Share can run straight from the tap.
  const version = e?.updatedAt;
  useEffect(() => {
    if (!e || !photoCount(e)) return;
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
  }, [id, version, settings.splitMB]);

  if (!e) return <Navigate to="/?m=evidence" replace />;
  const files = evidenceFiles(e);
  const shown = files.slice(0, 10);
  const zipFiles = pack ? pack.parts.map((p) => toFile(p.blob, p.name, 'application/zip')) : [];
  const shareable = zipFiles.length > 0 && canShareFiles(zipFiles);
  const markExported = () => updateEvidence(e.id, (d) => void (d.exportedAt = nowISO()), { touch: false });

  async function onShare() {
    const r = await shareFiles(zipFiles, `${e!.title || e!.machineCode} photo evidence`);
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
      <AppBar title="Export photos" sub={e.title || e.machineCode} back={`/evidence/${e.id}`} />
      <main className="content">
        <section className="card stack">
          <div className="between">
            <b>
              {plural(files.length, 'photo')} · {plural(e.shots.filter((s) => s.photos.length).length, 'shot')}
            </b>
            <EvidenceChip e={e} />
          </div>
          <div className="eyebrow">Inside the zip</div>
          <div className="tree">
            {[
              `${evidenceZipPrefix(e)}.zip`,
              ...shown.map((f) => `├─ ${f.filename}`),
              ...(files.length > shown.length ? [`├─ … ${files.length - shown.length} more`] : []),
              '└─ manifest.json',
            ].join('\n')}
          </div>
          <p className="hint">Photos keep the names you typed. Unnamed photos get an automatic name. Empty shots are left out.</p>
        </section>

        <section className="card stack">
          {error ? (
            <div className="banner bad">Could not build the zip: {error}</div>
          ) : !pack ? (
            <div className="row muted">
              <Loader2 className="spin" /> {progress}
            </div>
          ) : (
            <>
              <div className="between">
                <b>
                  {pack.parts.length > 1 ? `${pack.parts.length} zip parts` : 'Zip ready'} · {fmtSize(pack.totalBytes)}
                </b>
              </div>
              {pack.parts.length > 1 ? (
                <p className="hint">
                  Split into parts under {settings.splitMB} MB so each fits WhatsApp. Send every part; part 1 holds the manifest.
                </p>
              ) : null}
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
      </main>
    </div>
  );
}
