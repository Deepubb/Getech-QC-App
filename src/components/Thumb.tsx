import { useEffect, useState } from 'react';
import { getPhoto } from '../data/db';

const cache = new Map<string, string>();

export function revokeThumb(id: string) {
  const url = cache.get(id);
  if (url) URL.revokeObjectURL(url);
  cache.delete(id);
}

export function useThumb(id: string | undefined): string | undefined {
  const [url, setUrl] = useState(() => (id ? cache.get(id) : undefined));
  useEffect(() => {
    if (!id) return;
    if (cache.has(id)) {
      setUrl(cache.get(id));
      return;
    }
    let alive = true;
    getPhoto(id).then((p) => {
      if (!p || !alive) return;
      const u = URL.createObjectURL(p.thumb);
      cache.set(id, u);
      setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function Thumb({ id, className = 'thumb', alt = '' }: { id: string; className?: string; alt?: string }) {
  const url = useThumb(id);
  return url ? <img className={className} src={url} alt={alt} /> : <div className={className} aria-hidden="true" />;
}
