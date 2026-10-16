import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { applyUpdate, checkForUpdate, safeToUpdate, setRegistration } from '../app/updates';

/** Installs a new version by itself as soon as it is safe; until then shows that one is ready. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      setRegistration(reg);
      if (!reg) return;
      // Look whenever the app comes back to the screen or online, and every 30 minutes.
      const check = () => void checkForUpdate();
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      window.addEventListener('online', check);
      setInterval(check, 30 * 60 * 1000);
    },
  });

  // A newer version took over while this screen was in the background: it still runs the old
  // code, so reload it as soon as that is safe.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onChange = () => setStale(true);
    sw.addEventListener('controllerchange', onChange);
    return () => sw.removeEventListener('controllerchange', onChange);
  }, []);
  useEffect(() => {
    if (!stale) return;
    const reload = () => safeToUpdate() && window.location.reload();
    reload();
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [stale]);

  useEffect(() => {
    if (!needRefresh) return;
    let started = false;
    const apply = () => {
      if (started || !safeToUpdate()) return;
      started = true;
      void applyUpdate();
    };
    apply();
    // Not safe yet (a sheet or field in use, the camera open): try again shortly and on return.
    const timer = setInterval(apply, 3000);
    document.addEventListener('visibilitychange', apply);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', apply);
    };
  }, [needRefresh]);

  if (!needRefresh) return null;
  return (
    <div className="toast-wrap" style={{ top: 'auto', bottom: 'calc(84px + var(--safe-bottom))', pointerEvents: 'auto' }}>
      <div className="toast" role="status">
        <RefreshCw />
        <span>A new version is ready.</span>
        <button className="btn btn-sm btn-accent" onClick={() => void applyUpdate()}>
          Update now
        </button>
      </div>
    </div>
  );
}
