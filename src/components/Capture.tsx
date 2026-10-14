import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { plural } from '../core/format';
import { useApp } from '../data/store';
import { toast, vibrate } from './ui';

/** Take photo uses the rear camera; From gallery allows picking many at once. */
export function CaptureButtons({ evidenceId, shotId, primaryLabel = 'Take photo' }: { evidenceId: string; shotId: string | null; primaryLabel?: string }) {
  const addPhotos = useApp((s) => s.addPhotos);
  const cam = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(list: FileList | null) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    setBusy(files.length > 1 ? `Adding ${files.length} photos…` : 'Adding photo…');
    const { added, failed } = await addPhotos(evidenceId, shotId, files);
    setBusy(null);
    vibrate(15);
    if (failed) toast(`${plural(added, 'photo')} added, ${failed} could not be read.`, 'bad');
    else toast(`${plural(added, 'photo')} added.`, 'good');
  }

  return (
    <>
      <div className="capture">
        <button className="btn btn-amber" disabled={!!busy} onClick={() => cam.current?.click()}>
          {busy ? <Loader2 className="spin" /> : <Camera />}
          {busy ?? primaryLabel}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => gallery.current?.click()}>
          <ImagePlus />
          Gallery
        </button>
      </div>
      <input
        ref={cam}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}
