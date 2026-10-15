import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { nameTaken, safeName, toTake } from '../core/evidence';
import { plural } from '../core/format';
import type { EvidenceSet } from '../core/types';
import { useApp } from '../data/store';
import { PhotoView } from './PhotoView';
import { Sheet, toast, vibrate } from './ui';

/**
 * Take a photo, name it, take the next one. Photos are stored the moment they arrive, so closing the
 * name sheet never loses one; an unnamed photo is flagged and blocks export until it is named.
 */
export function useQuickCapture(e: EvidenceSet, categoryId: string) {
  const { addPhoto, updateEvidence } = useApp();
  const cam = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const preset = useRef<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [fromGallery, setFromGallery] = useState(false);
  const category = e.categories.find((c) => c.id === categoryId);

  const takePhoto = (name = '') => {
    preset.current = name;
    cam.current?.click();
  };
  const pickFromGallery = () => {
    preset.current = '';
    gallery.current?.click();
  };

  async function onFiles(list: FileList | null, viaGallery: boolean) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    setBusy(files.length > 1 ? `Saving ${files.length} photos…` : 'Saving photo…');
    const ids: string[] = [];
    for (const f of files) {
      try {
        const name = files.length === 1 && preset.current && !nameTaken(category!, preset.current) ? preset.current : '';
        ids.push(await addPhoto(e.id, categoryId, f, name));
      } catch {
        toast('A photo could not be read and was skipped.', 'bad');
      }
    }
    setBusy(null);
    vibrate(15);
    if (files.length === 1 && preset.current && ids.length) {
      toast(`Saved as ${safeName(preset.current)}.jpg`, 'good');
      preset.current = '';
      return;
    }
    preset.current = '';
    setFromGallery(viaGallery);
    setQueue(ids);
  }

  const current = queue[0];
  const photo = category?.photos.find((p) => p.id === current);
  const suggestion = category ? (toTake(category)[0] ?? '') : '';

  async function saveName(name: string) {
    if (!current) return;
    await updateEvidence(e.id, (d) => {
      const p = d.categories.find((c) => c.id === categoryId)?.photos.find((x) => x.id === current);
      if (p) p.name = safeName(name);
    });
  }

  const sheet: ReactNode =
    current && photo && category ? (
      <NameSheet
        key={current}
        photoId={current}
        categoryName={category.name}
        suggestion={suggestion}
        remaining={queue.length - 1}
        nextLabel={fromGallery && queue.length > 1 ? 'Save and name next' : 'Save and take next'}
        isTaken={(n) => nameTaken(category, n, current)}
        onSave={async (name, next) => {
          await saveName(name);
          const rest = queue.slice(1);
          setQueue(rest);
          if (next && !rest.length && !fromGallery) takePhoto();
        }}
        onLater={() => {
          setQueue(queue.slice(1));
          toast('Saved without a name. Name it before you export.', 'info');
        }}
      />
    ) : null;

  const buttons = (
    <div className="capture">
      <button className="btn btn-amber" disabled={!!busy} onClick={() => takePhoto()}>
        {busy ? <Loader2 className="spin" /> : <Camera />}
        {busy ?? 'Take photo'}
      </button>
      <button className="btn" disabled={!!busy} onClick={pickFromGallery}>
        <ImagePlus />
        Gallery
      </button>
      <input
        ref={cam}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(ev) => {
          void onFiles(ev.target.files, false);
          ev.target.value = '';
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(ev) => {
          void onFiles(ev.target.files, true);
          ev.target.value = '';
        }}
      />
    </div>
  );

  return { buttons, sheet, takePhoto, busy };
}

function NameSheet(props: {
  photoId: string;
  categoryName: string;
  suggestion: string;
  remaining: number;
  nextLabel: string;
  isTaken: (name: string) => boolean;
  onSave: (name: string, next: boolean) => void;
  onLater: () => void;
}) {
  const [name, setName] = useState(props.suggestion);
  const clean = safeName(name);
  const taken = !!clean && props.isTaken(clean);
  const ok = !!clean && !taken;
  return (
    <Sheet open onClose={props.onLater} title="Name this photo">
      <PhotoView id={props.photoId} alt="The photo you just took" />
      <form
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (ok) props.onSave(clean, true);
        }}
      >
        <label className="field">
          <span className="label">
            Photo name · saved in <b>{props.categoryName}</b>
          </span>
          <div className="suffix">
            <input
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              autoFocus
              enterKeyHint="next"
              placeholder="e.g. Emergency stop button"
              aria-invalid={taken}
            />
            <span>.jpg</span>
          </div>
          {taken ? (
            <span className="hint bad">That name is already used in {props.categoryName}.</span>
          ) : clean && clean !== name.trim() ? (
            <span className="hint">Saved as {clean}.jpg</span>
          ) : (
            <span className="hint">{props.remaining > 0 ? `${plural(props.remaining, 'more photo')} to name after this one.` : 'This is exactly the file name in the zip.'}</span>
          )}
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={!ok}>
          {props.nextLabel}
        </button>
        <div className="btn-row">
          <button type="button" className="btn" disabled={!ok} onClick={() => props.onSave(clean, false)}>
            Save
          </button>
          <button type="button" className="btn btn-ghost" onClick={props.onLater}>
            Name later
          </button>
        </div>
      </form>
    </Sheet>
  );
}
