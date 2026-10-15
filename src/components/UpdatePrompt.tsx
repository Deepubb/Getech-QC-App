import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Shows a reload button when a new version has been downloaded in the background. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // The browser only looks for a new version on a full page load, which an installed app
    // rarely does. Look again whenever the app comes back to the screen, and every 30 minutes.
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => void reg.update().catch(() => undefined);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      setInterval(check, 30 * 60 * 1000);
    },
  });
  // A new version found while the app is still opening is installed straight away: nothing has
  // been typed yet, so nothing can be lost. Later on, the engineer chooses when.
  useEffect(() => {
    if (needRefresh && performance.now() < 20_000) void updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);
  if (!needRefresh) return null;
  return (
    <div className="toast-wrap" style={{ top: 'auto', bottom: 'calc(84px + var(--safe-bottom))', pointerEvents: 'auto' }}>
      <div className="toast" role="status">
        <RefreshCw />
        <span>A new version is ready.</span>
        <button className="btn btn-sm btn-amber" onClick={() => updateServiceWorker(true)}>
          Update
        </button>
        <button className="btn btn-sm btn-ghost" style={{ color: 'inherit' }} onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    </div>
  );
}
