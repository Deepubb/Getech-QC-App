import { useEffect, useState } from 'react';
import { getPhoto } from '../data/db';

/** Full-size preview; the object URL is released when the view closes. */
export function PhotoView({ id, alt, className = 'preview' }: { id: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let u: string | undefined;
    let alive = true;
    getPhoto(id).then((p) => {
      if (!p || !alive) return;
      u = URL.createObjectURL(p.full);
      setUrl(u);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return url ? <img className={className} src={url} alt={alt} /> : <div className={className} aria-hidden="true" />;
}
