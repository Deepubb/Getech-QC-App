import type { StoredPhoto } from '../core/types';

/**
 * Every photo is cut to 16:9: landscape when the phone was held sideways, 9:16 when held upright.
 * The long side keeps the camera's own pixels up to 4096 px (a 12 MP phone photo is not resampled
 * at all) and stays inside the largest canvas every phone browser can draw.
 */
const FULL_EDGE = 4096;
const FULL_QUALITY = 0.92;
const THUMB_EDGE = 320;
const RATIO = 16 / 9;

function stampText(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> decoding, e.g. for formats ImageBitmap rejects */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That file could not be read as an image.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(src: ImageBitmap | HTMLImageElement, maxEdge: number, stamp: string | null, quality: number): Promise<Blob> {
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height;
  // The largest 16:9 (or 9:16) area in the middle of the photo.
  const landscape = w0 >= h0;
  const long0 = Math.max(w0, h0);
  const short0 = Math.min(w0, h0);
  const cropLong = Math.min(long0, short0 * RATIO);
  const cropShort = cropLong / RATIO;
  const sw = landscape ? cropLong : cropShort;
  const sh = landscape ? cropShort : cropLong;
  const long = Math.max(1, Math.round(Math.min(maxEdge, cropLong)));
  const short = Math.max(1, Math.round(long / RATIO));
  const w = landscape ? long : short;
  const h = landscape ? short : long;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process photos.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (w0 - sw) / 2, (h0 - sh) / 2, sw, sh, 0, 0, w, h);
  if (stamp) {
    const fs = Math.max(14, Math.round(w / 55));
    const pad = Math.round(fs * 0.45);
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    const tw = ctx.measureText(stamp).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(pad, h - fs - pad * 3, tw + pad * 2, fs + pad * 2);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.fillText(stamp, pad * 2, h - fs - pad * 2);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the photo.'))), 'image/jpeg', quality),
  );
}

/**
 * Cuts to 16:9 around the centre, keeps up to 4096 px on the long side, stamps the capture time and
 * re-encodes as high-quality JPEG.
 * Re-encoding through a canvas drops EXIF, including GPS.
 */
export async function processImage(file: Blob): Promise<StoredPhoto> {
  const img = await decode(file);
  try {
    const full = await draw(img, FULL_EDGE, stampText(), FULL_QUALITY);
    const thumb = await draw(img, THUMB_EDGE, null, 0.7);
    return { full, thumb };
  } finally {
    if ('close' in img) img.close();
  }
}
