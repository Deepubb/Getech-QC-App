import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Share2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ResultBar } from '../components/ResultBar';
import { ChecklistChip } from '../components/StatusChip';
import { AppBar, toast } from '../components/ui';
import { fmtDateTime, fmtSize, plural } from '../core/format';
import { checklistFileName } from '../core/names';
import { itemProblems } from '../core/rules';
import { nowISO } from '../core/ids';
import { canShareFiles, downloadBlob, shareFiles, toFile } from '../export/share';
import { useApp } from '../data/store';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function ChecklistExport() {
  const { id = '' } = useParams();
  const { checklists, updateChecklist } = useApp();
  const c = checklists.find((x) => x.id === id);
  const [report, setReport] = useState<{ blob: Blob; forVersion: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build the workbook as soon as the checklist is complete, so Share can run straight from the tap.
  const version = c?.updatedAt;
  const completed = c?.status === 'completed';
  useEffect(() => {
    if (!c || !completed) return;
    let alive = true;
    setError(null);
    import('../reports/checklistReport')
      .then(({ buildChecklistReport }) => buildChecklistReport(c))
      .then((blob) => alive && setReport({ blob, forVersion: c.updatedAt }))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version, completed]);

  if (!c) return <Navigate to="/" replace />;
  const missing = c.items.filter((i) => !i.completedAt);
  const fileName = checklistFileName(c.machineCode);
  const ready = report && report.forVersion === c.updatedAt ? report.blob : null;
  const file = ready ? toFile(ready, fileName, XLSX_TYPE) : null;
  const shareable = file ? canShareFiles([file]) : false;
  // Recording the export must not count as an edit, or the label would flip back to Not exported.
  const markExported = () => updateChecklist(c.id, (d) => void (d.exportedAt = nowISO()), { touch: false });

  async function onShare() {
    if (!file) return;
    const r = await shareFiles([file], `${c!.machineName} QC checklist`);
    if (r === 'shared') {
      await markExported();
      toast('Shared. Marked as exported.', 'good');
    } else if (r === 'failed') toast('Sharing failed. Use Download instead.', 'bad');
  }
  async function onDownload() {
    if (!ready) return;
    downloadBlob(ready, fileName);
    await markExported();
    toast('Downloaded. Marked as exported.', 'good');
  }

  return (
    <div className="shell">
      <AppBar title="Complete and export" sub={c.machineCode} back={`/checklists/${c.id}`} />
      <main className="content">
        <div className="card stack">
          <div className="between">
            <b>{c.machineName}</b>
            <ChecklistChip c={c} />
          </div>
          <ResultBar c={c} legend />
        </div>

        {missing.length > 0 ? (
          <>
            <div className="banner bad">
              <XCircle />
              <span>
                <b>{plural(missing.length, 'item')} still open.</b> Finish them before you complete the checklist.
              </span>
            </div>
            <div className="list">
              {missing.map((i) => (
                <Link key={i.id} className="li" to={`/checklists/${c.id}/items/${i.id}`}>
                  <span className="no">{i.itemNo}</span>
                  <span className="t">
                    {i.procedure}
                    <div className="s" style={{ color: 'var(--nok)' }}>
                      {itemProblems(i)[0] ?? 'Save this item'}
                    </div>
                  </span>
                  <span className="pill pending">Open</span>
                </Link>
              ))}
            </div>
          </>
        ) : c.status === 'in_progress' ? (
          <>
            <div className="banner good">
              <CheckCircle2 />
              <span>Every item has a saved result.</span>
            </div>
            <button className="btn btn-primary btn-block" onClick={() => updateChecklist(c.id, (d) => void (d.status = 'completed'))}>
              Mark checklist complete
            </button>
          </>
        ) : (
          <>
            <div className="card stack">
              <div className="row">
                <FileSpreadsheet style={{ color: 'var(--ok)', width: 34, height: 34 }} />
                <div className="grow">
                  <div className="mono small wrap-anywhere">{fileName}</div>
                  <div className="tiny muted">{ready ? `GeTech buyoff layout · ${fmtSize(ready.size)}` : error ? `Could not build the report: ${error}` : 'Preparing the report…'}</div>
                </div>
              </div>
              {shareable ? (
                <button className="btn btn-primary btn-block" disabled={!ready} onClick={onShare}>
                  <Share2 /> Share to WhatsApp, Drive, Files…
                </button>
              ) : null}
              <button className={`btn btn-block ${shareable ? '' : 'btn-primary'}`} disabled={!ready} onClick={onDownload}>
                <Download /> Download
              </button>
              {c.exportedAt ? <div className="tiny muted">Last exported {fmtDateTime(c.exportedAt)}</div> : null}
              <div className="tiny muted">Photos are not part of this file. Photo evidence is exported separately from its own screen.</div>
            </div>
            <button className="btn btn-ghost" onClick={() => updateChecklist(c.id, (d) => void (d.status = 'in_progress'))}>
              <RotateCcw /> Reopen to edit
            </button>
          </>
        )}
      </main>
    </div>
  );
}
