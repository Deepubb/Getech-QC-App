import { Ban, Camera, Check, ChevronRight, ImagePlus, Loader2, MoreHorizontal, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCamera } from '../components/Camera';
import { PhotoView } from '../components/PhotoView';
import { ProgressBar } from '../components/ProgressBar';
import { revokeThumb, Thumb } from '../components/Thumb';
import { AppBar, ConfirmSheet, Field, Sheet, toast, vibrate } from '../components/ui';
import {
  groupByPath,
  isMissing,
  itemName,
  itemPath,
  nameClash,
  needsFt,
  nextMissing,
  photoFileNames,
  progressOf,
  safeName,
  setTitle,
  usedFts,
} from '../core/evidence';
import { fmtDateTime, plural } from '../core/format';
import { fillFixture, parseCell } from '../core/masterList';
import type { EvidenceFolder, EvidenceItem, EvidencePhoto, EvidenceSet } from '../core/types';
import { useApp } from '../data/store';

type Target = { itemId: string; replaceId?: string } | { extra: { path: string[]; name: string } };
type Filter = 'all' | 'todo' | 'done';

export function FolderScreen() {
  const { id = '', folderId = '' } = useParams();
  const e = useApp((s) => s.evidence.find((x) => x.id === id));
  if (!e) return <Navigate to="/" replace />;
  const folder = e.folders.find((f) => f.id === folderId);
  if (!folder) return <Navigate to={`/evidence/${e.id}`} replace />;
  return <FolderView key={folder.id} e={e} folder={folder} />;
}

const findItem = (evidenceId: string, folderId: string, itemId: string) =>
  useApp
    .getState()
    .evidence.find((x) => x.id === evidenceId)
    ?.folders.find((f) => f.id === folderId)
    ?.items.find((i) => i.id === itemId);

function FolderView({ e, folder }: { e: EvidenceSet; folder: EvidenceFolder }) {
  const nav = useNavigate();
  const { addPhoto, addExtraItem, setPhotoFt } = useApp();
  const [last, setLast] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [extra, setExtra] = useState(false);
  /** Photos just taken of a {fixture} item, waiting for their FT number. */
  const [ftAsk, setFtAsk] = useState<{ itemId: string; photoIds: string[] } | null>(null);
  const p = progressOf(folder.items);
  const next = nextMissing(folder.items, last);
  const idx = e.folders.findIndex((f) => f.id === folder.id);
  const nextFolder = e.folders[idx + 1];

  const savedToast = (itemId: string, photoId: string) => {
    const item = findItem(e.id, folder.id, itemId);
    const at = item?.photos.findIndex((x) => x.id === photoId) ?? -1;
    if (item && at >= 0) toast(`Saved ${photoFileNames(item)[at]}`, 'good');
  };

  const camera = useCamera<Target>(async (files, t) => {
    let itemId = 'itemId' in t ? t.itemId : '';
    if ('extra' in t) itemId = await addExtraItem(e.id, folder.id, t.extra.path, t.extra.name);
    const ids: string[] = [];
    for (const [n, f] of files.entries()) {
      try {
        ids.push(await addPhoto(e.id, itemId, f, n === 0 && 'replaceId' in t ? t.replaceId : undefined));
      } catch {
        toast('A photo could not be read and was skipped.', 'bad');
      }
    }
    if (!ids.length) return;
    vibrate(15);
    setLast(itemId);
    const item = findItem(e.id, folder.id, itemId);
    if (!item) return;
    const ask = needsFt(item) ? ids.filter((pid) => !safeName(item.photos.find((x) => x.id === pid)?.ft)) : [];
    if (ask.length) setFtAsk({ itemId, photoIds: ask });
    else if (ids.length > 1) toast(`${ids.length} photos saved to ${itemName(item)}.`, 'good');
    else savedToast(itemId, ids[0]);
  });

  const shown = folder.items.filter((i) => (filter === 'all' ? true : filter === 'todo' ? isMissing(i) : !isMissing(i)));
  const item = folder.items.find((i) => i.id === openItem);
  const ftItem = ftAsk ? folder.items.find((i) => i.id === ftAsk.itemId) : undefined;

  return (
    <div className="shell">
      <AppBar title={folder.name} sub={`${setTitle(e)} · ${p.taken} of ${p.total} taken`} back={`/evidence/${e.id}`} />
      <main className="content with-bar">
        <section className="card stack" style={{ gap: 10 }}>
          <ProgressBar p={p} />
          <div className="between small muted tnum">
            <span>
              {p.taken} taken{p.na ? ` · ${p.na} not applicable` : ''}
            </span>
            <span>{p.missing ? `${p.missing} to take` : 'All done'}</span>
          </div>
        </section>

        <div className="filters" role="tablist" aria-label="Show">
          {(
            [
              ['all', `All ${folder.items.length}`],
              ['todo', `To take ${p.missing}`],
              ['done', `Done ${folder.items.length - p.missing}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>

        {groupByPath(shown).map((g) => (
          <section key={g.path.join('/') || '-'} className="stack" style={{ gap: 8 }}>
            {g.path.length ? (
              <div className="group-head">
                <span>{itemPath({ path: g.path }).join(' › ')}</span>
                <span className="tnum">
                  {g.items.filter((i) => !isMissing(i)).length}/{g.items.length}
                </span>
              </div>
            ) : null}
            <div className="list">
              {g.items.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  isNext={i.id === next?.id}
                  busy={camera.busy}
                  onTap={() => (isMissing(i) ? camera.open({ itemId: i.id }) : setOpenItem(i.id))}
                  onMore={() => setOpenItem(i.id)}
                />
              ))}
            </div>
          </section>
        ))}
        {!shown.length ? (
          <p className="muted" style={{ textAlign: 'center', padding: 16 }}>
            {filter === 'todo' ? 'Nothing left to take here.' : 'No photos taken yet.'}
          </p>
        ) : null}

        <button className="btn btn-block" onClick={() => setExtra(true)}>
          <Plus /> Add a photo not on the list
        </button>
      </main>

      <div className="actionbar">
        <div>
          {next ? (
            <button className="btn btn-amber btn-block" style={{ minHeight: 58 }} disabled={camera.busy} onClick={() => camera.open({ itemId: next.id })}>
              {camera.busy ? <Loader2 className="spin" /> : <Camera />}
              <span className="wrap-anywhere" style={{ textAlign: 'left' }}>
                {camera.busy ? (
                  'Saving…'
                ) : (
                  <>
                    Take next: <b>{itemName(next)}</b>
                  </>
                )}
              </span>
            </button>
          ) : nextFolder ? (
            <button className="btn btn-primary btn-block" onClick={() => nav(`/evidence/${e.id}/f/${nextFolder.id}`, { replace: true })}>
              <Check /> Done here · next: {nextFolder.name} <ChevronRight />
            </button>
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => nav(`/evidence/${e.id}`)}>
              <Check /> Folder done · back to machine
            </button>
          )}
        </div>
      </div>

      {camera.inputs}
      {item ? (
        <ItemSheet
          e={e}
          folder={folder}
          item={item}
          onClose={() => setOpenItem(null)}
          onCapture={(t, from) => {
            setOpenItem(null);
            camera.open(t, from);
          }}
        />
      ) : null}
      {ftAsk && ftItem ? (
        <FtSheet
          key={ftAsk.photoIds[0]}
          e={e}
          item={ftItem}
          photoId={ftAsk.photoIds[0]}
          remaining={ftAsk.photoIds.length - 1}
          onSave={async (ft, another) => {
            const photoId = ftAsk.photoIds[0];
            await setPhotoFt(e.id, ftItem.id, photoId, ft);
            savedToast(ftItem.id, photoId);
            const rest = ftAsk.photoIds.slice(1);
            setFtAsk(rest.length ? { ...ftAsk, photoIds: rest } : null);
            if (another && !rest.length) camera.open({ itemId: ftItem.id });
          }}
          onLater={() => {
            const rest = ftAsk.photoIds.slice(1);
            setFtAsk(rest.length ? { ...ftAsk, photoIds: rest } : null);
            toast('Saved without an FT number. Add it before you export.', 'info');
          }}
        />
      ) : null}
      <ExtraSheet
        open={extra}
        folder={folder}
        onClose={() => setExtra(false)}
        onTake={(path, name, from) => {
          setExtra(false);
          camera.open({ extra: { path, name } }, from);
        }}
      />
    </div>
  );
}

function ItemRow({ item, isNext, busy, onTap, onMore }: { item: EvidenceItem; isNext: boolean; busy: boolean; onTap: () => void; onMore: () => void }) {
  const n = item.photos.length;
  const latest = item.photos[n - 1];
  const fixture = needsFt(item);
  const fts = item.photos.map((x) => safeName(x.ft)).filter(Boolean);
  const noFt = fixture ? n - fts.length : 0;
  return (
    <div className={`li item-row ${isNext ? 'next' : ''}`}>
      <button className="item-main" onClick={onTap} disabled={busy && isMissing(item)}>
        {latest ? (
          <Thumb id={latest.id} />
        ) : item.na ? (
          <span className="thumb slot" aria-hidden="true">
            <Ban />
          </span>
        ) : (
          <span className="thumb slot todo-slot" aria-hidden="true">
            <Camera />
          </span>
        )}
        <span className="t">
          <b className="wrap-anywhere">{itemName(item)}</b>
          <div className="s">
            {n ? (
              <span className="ok-text">
                <Check size={13} style={{ verticalAlign: '-2px' }} />{' '}
                {fixture ? (fts.length ? fts.join(', ') : plural(n, 'photo')) : n > 1 ? plural(n, 'photo') : photoFileNames(item)[0]}
              </span>
            ) : item.na ? (
              'Not applicable'
            ) : (
              'Tap to take'
            )}
            {noFt ? <span className="bad-text"> · {noFt} {noFt === 1 ? 'needs' : 'need'} FT number</span> : null}
            {item.extra ? ' · not on the list' : ''}
          </div>
        </span>
      </button>
      <button className="iconbtn" aria-label={`More for ${itemName(item)}`} onClick={onMore}>
        <MoreHorizontal />
      </button>
    </div>
  );
}

/** Asks for the FT number of a photo just taken of a {fixture} item. */
function FtSheet({
  e,
  item,
  photoId,
  remaining,
  onSave,
  onLater,
}: {
  e: EvidenceSet;
  item: EvidenceItem;
  photoId: string;
  remaining: number;
  onSave: (ft: string, another: boolean) => Promise<void>;
  onLater: () => void;
}) {
  const [ft, setFt] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = safeName(ft);
  const used = usedFts(e).slice(0, 8);
  const save = async (another: boolean) => {
    if (!clean || busy) return;
    setBusy(true);
    await onSave(clean, another);
  };
  return (
    <Sheet open onClose={onLater} title="FT number">
      <PhotoView id={photoId} alt={itemName(item)} />
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault();
          void save(false);
        }}
      >
        <Field label={itemName(item)} hint={clean ? <span className="mono wrap-anywhere">{safeName(fillFixture(item.name, clean))}.jpg</span> : undefined}>
          <input className="mono" value={ft} onChange={(ev) => setFt(ev.target.value)} placeholder="e.g. FT01" autoFocus autoCapitalize="characters" enterKeyHint="done" />
        </Field>
        {used.length ? (
          <div className="cats">
            {used.map((f) => (
              <button key={f} type="button" className={`cat-chip ft-chip ${f.toLowerCase() === clean.toLowerCase() ? 'on' : ''}`} onClick={() => setFt(f)}>
                {f}
              </button>
            ))}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={!clean || busy}>
          {remaining ? `Save · ${remaining} more` : 'Save'}
        </button>
        <div className="btn-row">
          {remaining ? (
            <span />
          ) : (
            <button type="button" className="btn" disabled={!clean || busy} onClick={() => void save(true)}>
              <Camera /> Save and take another FT
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onLater}>
            Later
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function ItemSheet({
  e,
  folder,
  item,
  onClose,
  onCapture,
}: {
  e: EvidenceSet;
  folder: EvidenceFolder;
  item: EvidenceItem;
  onClose: () => void;
  onCapture: (t: Target, from: 'camera' | 'gallery') => void;
}) {
  const { updateEvidence, deleteItem } = useApp();
  const [photo, setPhoto] = useState<{ p: EvidencePhoto; index: number } | null>(null);
  const [remove, setRemove] = useState(false);
  const name = itemName(item);
  const names = photoFileNames(item);
  const fixture = needsFt(item);
  const setNa = (na: boolean) =>
    updateEvidence(e.id, (d) => {
      const it = d.folders.find((f) => f.id === folder.id)?.items.find((i) => i.id === item.id);
      if (it) it.na = na;
    });

  if (photo) {
    const current = item.photos.find((x) => x.id === photo.p.id) ?? photo.p;
    return (
      <PhotoSheet
        e={e}
        item={item}
        photo={current}
        file={names[photo.index] ?? ''}
        onClose={() => setPhoto(null)}
        onRetake={() => onCapture({ itemId: item.id, replaceId: photo.p.id }, 'camera')}
      />
    );
  }

  return (
    <>
      <Sheet open={!remove} onClose={onClose} title={name}>
        <div className="mono tiny muted wrap-anywhere">{[safeName(folder.name), ...itemPath(item)].join('/')}/</div>
        {item.photos.length ? (
          <div className="pgrid">
            {item.photos.map((p, i) => (
              <button key={p.id} className="pcell" onClick={() => setPhoto({ p, index: i })} aria-label={`Open ${names[i]}`}>
                <Thumb id={p.id} className="img" />
                {fixture && !safeName(p.ft) ? <span className="nm bad">Needs FT number</span> : <span className="nm">{names[i]}</span>}
              </button>
            ))}
          </div>
        ) : item.na ? (
          <div className="banner info">
            <Ban />
            <span>Marked not applicable.</span>
          </div>
        ) : null}
        <div className="btn-row">
          <button className="btn btn-amber" onClick={() => onCapture({ itemId: item.id }, 'camera')}>
            <Camera /> {item.photos.length ? (fixture ? 'Another FT' : 'Add photo') : 'Take photo'}
          </button>
          <button className="btn" onClick={() => onCapture({ itemId: item.id }, 'gallery')}>
            <ImagePlus /> Gallery
          </button>
        </div>
        {item.photos.length || item.extra ? null : item.na ? (
          <button className="btn btn-block" onClick={() => void setNa(false).then(onClose)}>
            <Undo2 /> Needed after all
          </button>
        ) : (
          <button className="btn btn-block" onClick={() => void setNa(true).then(onClose)}>
            <Ban /> Not applicable on this machine
          </button>
        )}
        {item.extra ? (
          <button className="btn btn-danger btn-block" onClick={() => setRemove(true)}>
            <Trash2 /> Remove this photo name
          </button>
        ) : null}
      </Sheet>
      <ConfirmSheet
        open={remove}
        title={`Remove ${name}?`}
        body={item.photos.length ? `Its ${plural(item.photos.length, 'photo')} are deleted from this phone.` : 'It has no photos.'}
        confirmLabel="Remove"
        danger
        onClose={() => setRemove(false)}
        onConfirm={async () => {
          item.photos.forEach((p) => revokeThumb(p.id));
          await deleteItem(e.id, item.id);
          onClose();
        }}
      />
    </>
  );
}

function PhotoSheet({ e, item, photo, file, onClose, onRetake }: { e: EvidenceSet; item: EvidenceItem; photo: EvidencePhoto; file: string; onClose: () => void; onRetake: () => void }) {
  const { deletePhoto, setPhotoFt } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [ft, setFt] = useState(photo.ft ?? '');
  const fixture = needsFt(item);
  const clean = safeName(ft);
  return (
    <>
      <Sheet open={!confirm} onClose={onClose} title={fixture && !safeName(photo.ft) ? itemName(item) : file}>
        <PhotoView id={photo.id} alt={file} />
        <div className="tiny muted">Taken {fmtDateTime(photo.takenAt)}</div>
        {fixture ? (
          <form
            className="row"
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!clean) return;
              await setPhotoFt(e.id, item.id, photo.id, clean);
              toast(`Saved ${safeName(fillFixture(item.name, clean))}.jpg`, 'good');
            }}
          >
            <input className="input grow mono" value={ft} onChange={(ev) => setFt(ev.target.value)} placeholder="FT number" aria-label="FT number" autoCapitalize="characters" />
            <button className="btn" type="submit" disabled={!clean || clean === safeName(photo.ft)}>
              Save FT
            </button>
          </form>
        ) : null}
        <div className="btn-row">
          <button className="btn" onClick={onRetake}>
            <RotateCcw /> Retake
          </button>
          <button className="btn btn-danger" onClick={() => setConfirm(true)}>
            <Trash2 /> Delete
          </button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirm}
        title={`Delete ${file}?`}
        body={item.photos.length > 1 && !fixture ? 'The other photos of this item are renumbered.' : 'It is removed from this phone.'}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          revokeThumb(photo.id);
          await deletePhoto(e.id, item.id, photo.id);
          toast('Photo deleted.');
          onClose();
        }}
      />
    </>
  );
}

function ExtraSheet({
  open,
  folder,
  onClose,
  onTake,
}: {
  open: boolean;
  folder: EvidenceFolder;
  onClose: () => void;
  onTake: (path: string[], name: string, from: 'camera' | 'gallery') => void;
}) {
  const [text, setText] = useState('');
  const shot = parseCell(text);
  const clash = !!shot && nameClash(folder, shot.path, shot.name);
  const ok = !!shot && !clash;
  const take = (from: 'camera' | 'gallery') => {
    if (!shot || clash) return;
    setText('');
    onTake(shot.path, shot.name, from);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Photo not on the list">
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault();
          take('camera');
        }}
      >
        <label className="field">
          <span className="label">Photo name</span>
          <input value={text} onChange={(ev) => setText(ev.target.value)} placeholder="e.g. EPSON > Loader Robot_Base" autoFocus enterKeyHint="go" />
          {clash ? (
            <span className="hint bad">That name is already in {folder.name}. Open it there to add another photo.</span>
          ) : shot ? (
            <span className="hint mono wrap-anywhere">
              Saved as {[safeName(folder.name), ...itemPath(shot), itemName(shot)].join('/')}.jpg
            </span>
          ) : null}
        </label>
        <div className="btn-row">
          <button type="submit" className="btn btn-amber" disabled={!ok}>
            <Camera /> Take photo
          </button>
          <button type="button" className="btn" disabled={!ok} onClick={() => take('gallery')}>
            <ImagePlus /> Gallery
          </button>
        </div>
      </form>
    </Sheet>
  );
}
