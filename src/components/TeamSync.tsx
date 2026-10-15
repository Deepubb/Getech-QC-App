import { useEffect } from 'react';
import { useApp } from '../data/store';
import { toast } from './ui';

const EVERY = 60_000;

/** Fetches the team master list when the app opens and whenever it comes back to the screen. */
export function TeamSync() {
  const syncTeam = useApp((s) => s.syncTeam);
  useEffect(() => {
    let last = 0;
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < EVERY) return;
      last = Date.now();
      void syncTeam().then((message) => message && toast(message, 'good'));
    };
    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, [syncTeam]);
  return null;
}
