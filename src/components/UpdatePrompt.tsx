import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { checkForUpdate, safeToUpdate, setRegistration } from '../app/updates';

/** Installs a new version by itself as soon as it is safe; until then shows that one is ready. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
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

  useEffect(() => {
    if (!needRefresh) return;
    const apply = () => {
      if (safeToUpdate()) void updateServiceWorker(true);
    };
    apply();
    // Not safe yet (a sheet or field in use, the camera open): try again shortly and on return.
    const timer = setInterval(apply, 3000);
    document.addEventListener('visibilitychange', apply);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', apply);
    };
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh) return null;
  return (
    <div className="toast-wrap" style={{ top: 'auto', bottom: 'calc(84px + var(--safe-bottom))', pointerEvents: 'auto' }}>
      <div className="toast" role="status">
        <RefreshCw />
        <span>A new version is ready.</span>
        <button className="btn btn-sm btn-accent" onClick={() => updateServiceWorker(true)}>
          Update now
        </button>
      </div>
    </div>
  );
}
