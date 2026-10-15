import { useRef, useState } from 'react';

/**
 * Opens the phone camera or gallery for a target and hands back the files. The input is clicked
 * straight from the tap, because phones only open the camera during a user gesture.
 */
export function useCamera<T>(onFiles: (files: File[], target: T) => Promise<void>) {
  const cam = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const target = useRef<T | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (t: T, from: 'camera' | 'gallery' = 'camera') => {
    target.current = t;
    (from === 'camera' ? cam : gallery).current?.click();
  };

  async function handle(list: FileList | null) {
    const files = list ? [...list] : [];
    const t = target.current;
    target.current = null;
    if (!files.length || t === null) return;
    setBusy(true);
    try {
      await onFiles(files, t);
    } finally {
      setBusy(false);
    }
  }

  const inputs = (
    <>
      <input
        ref={cam}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(ev) => {
          void handle(ev.target.files);
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
          void handle(ev.target.files);
          ev.target.value = '';
        }}
      />
    </>
  );

  return { open, inputs, busy };
}
