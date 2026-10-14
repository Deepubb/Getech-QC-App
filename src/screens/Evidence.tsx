import { ChevronRight, Images, MoreHorizontal, Package, Pencil, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CaptureButtons } from '../components/Capture';
import { EvidenceChip } from '../components/StatusChip';
import { Thumb } from '../components/Thumb';
import { AppBar, ConfirmSheet, Empty, Field, Sheet, toast } from '../components/ui';
import { fmtSize, plural } from '../core/format';
import { autoShotName, cleanName, duplicateNames } from '../core/names';
import { photoBytes, photoCount } from '../core/rules';
import { findShotList, useApp } from '../data/store';

export function EvidenceScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { evidence, shotlists, updateEvidence, deleteEvidence, saveShotList } = useApp();
  const e = evidence.find((x) => x.id === id);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'details' | 'names' | 'delete' | null>(null);
  if (!e) return <Navigate to="/?m=evidence" replace />;

  const n = photoCount(e);
  const dups = duplicateNames(e.shots);
  const named = [...new Set(e.shots.map((s) => cleanName(s.name)).filter(Boolean))];
  const existingList = findShotList(shotlists, e.machineCode);

  return (
    <div className="shell">
      <AppBar
        title={e.title || e.machineCode || 'Photo evidence'}
        sub={[e.machineCode, e.cwo].filter(Boolean).join(' · ') || 'Photo evidence'}
        back="/?m=evidence"
        actions={
          <button className="iconbtn" aria-label="More actions" onClick={() => setMenu(true)}>
            <MoreHorizontal />
          </button>
        }
      />
      <main className="content with-bar">
        <section className="card stack">
          <div className="between">
            <div>
              <div className="eyebrow">Photo evidence</div>
              <div className="tnum" style={{ font: '600 26px/1.1 var(--font-head)', marginTop: 4 }}>
                {n}
                <span className="muted" style={{ fontSize: 16 }}> {n === 1 ? 'photo' : 'photos'} · {plural(e.shots.length, 'shot')}</span>
              </div>
            </div>
            <EvidenceChip e={e} />
          </div>
          <CaptureButtons evidenceId={e.id} shotId={null} />
          <p className="hint">Each new photo becomes its own shot. Open a shot to name it or add more photos to it. There is no limit.</p>
        </section>

        {e.shots.length === 0 ? (
          <Empty icon={<Images />} title="No photos yet">
            <p>Tap Take photo to start. You can name each shot afterwards.</p>
          </Empty>
        ) : (
          <div className="list">
            {e.shots.map((s, i) => {
              const nm = cleanName(s.name);
              const dup = nm && dups.has(nm.toLowerCase());
              return (
                <Link key={s.id} to={`/evidence/${e.id}/shots/${s.id}`} className="li" style={{ gridTemplateColumns: '54px 1fr auto' }}>
                  {s.photos[0] ? (
                    <Thumb id={s.photos[0].id} />
                  ) : (
                    <span className="thumb slot">
                      <Images />
                    </span>
                  )}
                  <span className="t">
                    <span className={`mono wrap-anywhere ${nm ? '' : 'muted'}`} style={{ fontSize: 14 }}>
                      {nm ? `${nm}.jpg` : `${autoShotName(e, i)}.jpg`}
                    </span>
                    <div className="s" style={dup ? { color: 'var(--nok)' } : undefined}>
                      {dup ? 'Same name as another shot' : nm ? plural(s.photos.length, 'photo') : `Automatic name · ${plural(s.photos.length, 'photo')}`}
                    </div>
                  </span>
                  {s.photos.length ? <ChevronRight className="muted" /> : <span className="pill pending">Empty</span>}
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <div className="actionbar">
        <div>
          <button className="btn btn-primary btn-block" disabled={!n} onClick={() => nav(`/evidence/${e.id}/export`)}>
            <Package /> Export {plural(n, 'photo')} as zip{n ? ` · ${fmtSize(photoBytes(e))}` : ''}
          </button>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Photo evidence">
        <div className="list">
          <button className="li" onClick={() => (setMenu(false), setSheet('details'))}>
            <Pencil className="muted" />
            <span className="t">
              <b>Edit details</b>
              <div className="s">Title, machine code, CWO, customer</div>
            </span>
            <span />
          </button>
          <button className="li" onClick={() => (setMenu(false), setSheet('names'))}>
            <Save className="muted" />
            <span className="t">
              <b>Save names for next time</b>
              <div className="s">{e.machineCode ? `${plural(named.length, 'name')} as the shot list for ${e.machineCode}` : 'Needs a machine code'}</div>
            </span>
            <span />
          </button>
          <button className="li" onClick={() => (setMenu(false), setSheet('delete'))}>
            <Trash2 style={{ color: 'var(--nok)' }} />
            <span className="t">
              <b style={{ color: 'var(--nok)' }}>Delete photo evidence</b>
              <div className="s">Removes every photo in this set from the phone</div>
            </span>
            <span />
          </button>
        </div>
      </Sheet>

      <DetailsSheet
        open={sheet === 'details'}
        initial={e}
        onClose={() => setSheet(null)}
        onSave={(v) => updateEvidence(e.id, (d) => Object.assign(d, v)).then(() => toast('Details saved.', 'good'))}
      />
      <ConfirmSheet
        open={sheet === 'names'}
        title={existingList ? 'Replace saved names?' : 'Save names for next time?'}
        body={
          !e.machineCode
            ? 'Add a machine code in Edit details first. Names are saved per machine code.'
            : !named.length
              ? 'Name at least one shot first.'
              : `${plural(named.length, 'name')} become the shot list for ${e.machineCode}. New photo evidence for this machine can start with them.`
        }
        confirmLabel={existingList ? 'Replace' : 'Save'}
        onClose={() => setSheet(null)}
        onConfirm={async () => {
          if (!e.machineCode || !named.length) return;
          const r = await saveShotList(e.machineCode, named);
          toast(r === 'created' ? 'Shot list saved.' : 'Shot list replaced.', 'good');
        }}
      />
      <ConfirmSheet
        open={sheet === 'delete'}
        title="Delete this photo evidence?"
        body={`All ${plural(n, 'photo')} are removed from this phone. Export the zip first if you need them.`}
        confirmLabel="Delete"
        danger
        onClose={() => setSheet(null)}
        onConfirm={async () => {
          await deleteEvidence(e.id);
          toast('Photo evidence deleted.');
          nav('/?m=evidence', { replace: true });
        }}
      />
    </div>
  );
}

function DetailsSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: { title: string; machineCode: string; cwo: string; customer: string };
  onClose: () => void;
  onSave: (v: { title: string; machineCode: string; cwo: string; customer: string }) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <Sheet open={open} onClose={onClose} title="Edit details">
      <Field label="Title">
        <input value={v.title} onChange={(ev) => setV({ ...v, title: ev.target.value })} />
      </Field>
      <Field label="Machine code">
        <input className="mono" value={v.machineCode} onChange={(ev) => setV({ ...v, machineCode: ev.target.value })} />
      </Field>
      <div className="btn-row">
        <Field label="CWO">
          <input className="mono" value={v.cwo} onChange={(ev) => setV({ ...v, cwo: ev.target.value })} />
        </Field>
        <Field label="Customer">
          <input value={v.customer} onChange={(ev) => setV({ ...v, customer: ev.target.value })} />
        </Field>
      </div>
      <button
        className="btn btn-primary btn-block"
        onClick={() => {
          onSave({ title: v.title.trim(), machineCode: v.machineCode.trim(), cwo: v.cwo.trim(), customer: v.customer.trim() });
          onClose();
        }}
      >
        Save details
      </button>
    </Sheet>
  );
}
