import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CaptureButtons } from '../components/Capture';
import { revokeThumb, Thumb } from '../components/Thumb';
import { AppBar, ConfirmSheet, toast } from '../components/ui';
import { fmtDateTime } from '../core/format';
import { autoShotName, cleanName, isDuplicateName } from '../core/names';
import { useApp } from '../data/store';

export function ShotScreen() {
  const { id = '', shotId = '' } = useParams();
  const nav = useNavigate();
  const { evidence, updateEvidence, deletePhoto, deleteShot } = useApp();
  const e = evidence.find((x) => x.id === id);
  const idx = e ? e.shots.findIndex((s) => s.id === shotId) : -1;
  const [confirm, setConfirm] = useState<{ kind: 'photo'; photoId: string } | { kind: 'shot' } | null>(null);
  if (!e || idx < 0) return <Navigate to={e ? `/evidence/${e.id}` : '/?m=evidence'} replace />;
  const shot = e.shots[idx];
  const name = cleanName(shot.name);
  const dup = isDuplicateName(e.shots, shot);
  const go = (to: number) => nav(`/evidence/${e.id}/shots/${e.shots[to].id}`, { replace: true });

  return (
    <div className="shell">
      <AppBar title={`Shot ${idx + 1} of ${e.shots.length}`} sub={e.title || e.machineCode} back={`/evidence/${e.id}`} />
      <main className="content with-bar">
        <section className="card stack">
          <label className="field">
            <span className="label">Photo name</span>
            <div className="suffix">
              <input
                key={shot.id}
                defaultValue={shot.name}
                placeholder={autoShotName(e, idx)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(ev) => void updateEvidence(e.id, (d) => void (d.shots[idx].name = ev.target.value))}
              />
              <span>.jpg</span>
            </div>
            {dup ? (
              <span className="hint bad">Another shot already uses this name. The zip will add _2 to keep both.</span>
            ) : name ? (
              <span className="hint mono">Saved as {name}.jpg{shot.photos.length > 1 ? `, ${name}-2.jpg …` : ''}</span>
            ) : (
              <span className="hint">Empty: saved as {autoShotName(e, idx)}.jpg</span>
            )}
          </label>
        </section>

        <section className="card stack">
          <div className="between">
            <span className="eyebrow">Photos in this shot</span>
            <span className="small muted tnum">{shot.photos.length}</span>
          </div>
          {shot.photos.length ? (
            <div className="photos">
              {shot.photos.map((p, i) => (
                <div key={p.id} className="photo">
                  <Thumb id={p.id} className="" alt={`Photo ${i + 1}, taken ${fmtDateTime(p.takenAt)}`} />
                  <span className="n">{i + 1}</span>
                  <button className="del" aria-label={`Delete photo ${i + 1}`} onClick={() => setConfirm({ kind: 'photo', photoId: p.id })}>
                    <X />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">No photo in this shot yet.</p>
          )}
          <CaptureButtons evidenceId={e.id} shotId={shot.id} primaryLabel={shot.photos.length ? 'Add photo' : 'Take photo'} />
        </section>

        <button className="btn btn-danger btn-block" onClick={() => setConfirm({ kind: 'shot' })}>
          <Trash2 /> Delete this shot
        </button>
      </main>

      <div className="actionbar">
        <div>
          <div className="nav" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className="btn" disabled={idx === 0} onClick={() => go(idx - 1)}>
              <ChevronLeft /> Previous
            </button>
            <button className="btn" disabled={idx === e.shots.length - 1} onClick={() => go(idx + 1)}>
              Next <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      <ConfirmSheet
        open={confirm?.kind === 'photo'}
        title="Delete this photo?"
        body="It is removed from this phone."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.kind !== 'photo') return;
          revokeThumb(confirm.photoId);
          await deletePhoto(e.id, shot.id, confirm.photoId);
          toast('Photo deleted.');
        }}
      />
      <ConfirmSheet
        open={confirm?.kind === 'shot'}
        title="Delete this shot?"
        body={shot.photos.length ? `Its ${shot.photos.length} photo(s) are removed from this phone.` : 'The empty shot is removed.'}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          shot.photos.forEach((p) => revokeThumb(p.id));
          await deleteShot(e.id, shot.id);
          toast('Shot deleted.');
          nav(`/evidence/${e.id}`, { replace: true });
        }}
      />
    </div>
  );
}
