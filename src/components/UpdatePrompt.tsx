import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Shows a reload button when a new version has been downloaded in the background. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
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
