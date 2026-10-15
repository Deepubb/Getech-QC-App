import { Camera, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PhotoView } from '../components/PhotoView';
import { useQuickCapture } from '../components/QuickCapture';
import { revokeThumb, Thumb } from '../components/Thumb';
import { AppBar, ConfirmSheet, Field, Sheet, toast } from '../components/ui';
import { categoryTaken, nameTaken, safeName, toTake } from '../core/evidence';
import { fmtDateTime, plural } from '../core/format';
import type { EvidencePhoto, EvidenceSet } from '../core/types';
import { useApp } from '../data/store';

export function CategoryScreen() {
  const { id = '', catId = '' } = useParams();
  const { evidence } = useApp();
  const e = evidence.find((x) => x.id === id);
  if (!e) return <Navigate to="/?m=evidence" replace />;
  if (!e.categories.some((c) => c.id === catId)) return <Navigate to={`/evidence/${e.id}`} replace />;
  return <CategoryView key={catId} e={e} catId={catId} />;
}

function CategoryView({ e, catId }: { e: EvidenceSet; catId: string }) {
  const nav = useNavigate();
  const { updateEvidence, deleteCategory } = useApp();
  const idx = e.categories.findIndex((c) => c.id === catId);
  const cat = e.categories[idx];
  const capture = useQuickCapture(e, catId);
  const [open, setOpen] = useState<EvidencePhoto | null>(null);
  const [menu, setMenu] = useState<'menu' | 'rename' | 'delete' | null>(null);
  const [rename, setRename] = useState(cat.name);
  const todo = toTake(cat);
  const go = (to: number) => nav(`/evidence/${e.id}/c/${e.categories[to].id}`, { replace: true });
  const cleanRename = safeName(rename);
  const renameTaken = !!cleanRename && categoryTaken(e, cleanRename, cat.id);

  return (
    <div className="shell">
      <AppBar
        title={cat.name || 'Unnamed category'}
        sub={`${e.title || e.machineCode} · ${plural(cat.photos.length, 'photo')}`}
        back={`/evidence/${e.id}`}
        actions={
          <button className="iconbtn" aria-label="Category actions" onClick={() => setMenu('menu')}>
            <MoreHorizontal />
          </button>
        }
      />
      <main className="content with-bar">
        <section className="card stack">
          {capture.buttons}
          <p className="hint">Take a photo, type its name, then take the next. The name is the file name in the zip.</p>
        </section>

        {todo.length ? (
          <section className="stack" style={{ gap: 8 }}>
            <div className="group-head">
              <span>Still to take</span>
              <span className="tnum">{todo.length}</span>
            </div>
            <div className="todo">
              {todo.map((n) => (
                <button key={n} onClick={() => capture.takePhoto(n)} disabled={!!capture.busy}>
                  <Camera /> {n}
                </button>
              ))}
            </div>
            <p className="hint">Tap a name to take that photo; it is saved with that name straight away.</p>
          </section>
        ) : null}

        {cat.photos.length ? (
          <section className="stack" style={{ gap: 8 }}>
            <div className="group-head">
              <span>Photos</span>
              <span className="tnum">{cat.photos.length}</span>
            </div>
            <div className="pgrid">
              {cat.photos.map((p) => {
                const nm = safeName(p.name);
                return (
                  <button key={p.id} className="pcell" onClick={() => setOpen(p)} aria-label={nm ? `${nm}, open` : 'Unnamed photo, open to name it'}>
                    <Thumb id={p.id} className="img" />
                    <span className={`nm ${nm ? '' : 'bad'}`}>{nm ? `${nm}.jpg` : 'Needs a name'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : !todo.length ? (
          <p className="muted" style={{ textAlign: 'center', padding: 16 }}>
            No photos in {cat.name} yet.
          </p>
        ) : null}
      </main>

      <div className="actionbar">
        <div>
          <div className="nav" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className="btn" disabled={idx === 0} onClick={() => go(idx - 1)}>
              <ChevronLeft /> {idx > 0 ? e.categories[idx - 1].name : 'Previous'}
            </button>
            <button className="btn" disabled={idx === e.categories.length - 1} onClick={() => go(idx + 1)}>
              {idx < e.categories.length - 1 ? e.categories[idx + 1].name : 'Next'} <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {capture.sheet}
      {open ? <PhotoSheet e={e} catId={cat.id} photo={open} onClose={() => setOpen(null)} /> : null}

      <Sheet open={menu === 'menu'} onClose={() => setMenu(null)} title={cat.name}>
        <div className="list">
          <button className="li" onClick={() => (setRename(cat.name), setMenu('rename'))}>
            <Pencil className="muted" />
            <span className="t">
              <b>Rename category</b>
              <div className="s">Renames the folder in the zip</div>
            </span>
            <span />
          </button>
          <button className="li" onClick={() => setMenu('delete')}>
            <Trash2 style={{ color: 'var(--nok)' }} />
            <span className="t">
              <b style={{ color: 'var(--nok)' }}>Delete category</b>
              <div className="s">{cat.photos.length ? `Also deletes its ${plural(cat.photos.length, 'photo')}` : 'It has no photos'}</div>
            </span>
            <span />
          </button>
        </div>
      </Sheet>
      <Sheet open={menu === 'rename'} onClose={() => setMenu(null)} title="Rename category">
        <form
          className="stack"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!cleanRename || renameTaken) return;
            await updateEvidence(e.id, (d) => void (d.categories[idx].name = cleanRename));
            setMenu(null);
            toast('Category renamed.', 'good');
          }}
        >
          <Field label="Category name" hint={renameTaken ? <span className="bad">There is already a category with that name.</span> : 'This is the folder name in the zip.'}>
            <input value={rename} onChange={(ev) => setRename(ev.target.value)} autoFocus />
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={!cleanRename || renameTaken}>
            Save
          </button>
        </form>
      </Sheet>
      <ConfirmSheet
        open={menu === 'delete'}
        title={`Delete ${cat.name}?`}
        body={cat.photos.length ? `Its ${plural(cat.photos.length, 'photo')} are removed from this phone.` : 'The empty category is removed.'}
        confirmLabel="Delete"
        danger
        onClose={() => setMenu(null)}
        onConfirm={async () => {
          cat.photos.forEach((p) => revokeThumb(p.id));
          await deleteCategory(e.id, cat.id);
          toast('Category deleted.');
          nav(`/evidence/${e.id}`, { replace: true });
        }}
      />
    </div>
  );
}

function PhotoSheet({ e, catId, photo, onClose }: { e: EvidenceSet; catId: string; photo: EvidencePhoto; onClose: () => void }) {
  const { updateEvidence, deletePhoto } = useApp();
  const [name, setName] = useState(photo.name);
  const [target, setTarget] = useState(catId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const targetCat = e.categories.find((c) => c.id === target)!;
  const clean = safeName(name);
  const taken = !!clean && nameTaken(targetCat, clean, photo.id);

  async function save() {
    if (!clean || taken) return;
    await updateEvidence(e.id, (d) => {
      const from = d.categories.find((c) => c.id === catId)!;
      const p = from.photos.find((x) => x.id === photo.id);
      if (!p) return;
      p.name = clean;
      if (target !== catId) {
        from.photos = from.photos.filter((x) => x.id !== photo.id);
        d.categories.find((c) => c.id === target)!.photos.push(p);
      }
    });
    toast(target !== catId ? `Moved to ${targetCat.name}.` : 'Saved.', 'good');
    onClose();
  }

  return (
    <>
      <Sheet open={!confirmDelete} onClose={onClose} title={safeName(photo.name) ? 'Photo' : 'Name this photo'}>
        <PhotoView id={photo.id} alt={clean || 'Photo'} />
        <div className="tiny muted">Taken {fmtDateTime(photo.takenAt)}</div>
        <form
          className="stack"
          onSubmit={(ev) => {
            ev.preventDefault();
            void save();
          }}
        >
          <label className="field">
            <span className="label">Photo name</span>
            <div className="suffix">
              <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="e.g. Emergency stop button" />
              <span>.jpg</span>
            </div>
            {taken ? <span className="hint bad">That name is already used in {targetCat.name}.</span> : null}
          </label>
          <Field label="Category">
            <select value={target} onChange={(ev) => setTarget(ev.target.value)}>
              {e.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={!clean || taken}>
            Save
          </button>
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete photo
          </button>
        </form>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this photo?"
        body="It is removed from this phone."
        confirmLabel="Delete"
        danger
        onClose={() => {
          setConfirmDelete(false);
        }}
        onConfirm={async () => {
          revokeThumb(photo.id);
          await deletePhoto(e.id, catId, photo.id);
          toast('Photo deleted.');
          onClose();
        }}
      />
    </>
  );
}
