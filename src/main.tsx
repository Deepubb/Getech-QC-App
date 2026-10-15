import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary, reloadOnce } from './components/ErrorBoundary';
import { logProblem, watchProblems } from './data/problemLog';

watchProblems();

// iPhone Safari ignores user-scalable=no, so block its pinch gestures directly.
// Two-finger moves are cancelled everywhere; single-finger scrolling is untouched.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

const root = document.getElementById('root')!;
createRoot(root, {
  // Last line of defence: if an error gets past every boundary, React empties the page.
  // Reload once; if that already happened, leave a message and a button instead of a blank screen.
  onUncaughtError(error) {
    logProblem(`Uncaught: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
    if (reloadOnce()) return;
    root.innerHTML =
      '<div class="gate" role="alert"><h1>Something went wrong</h1><p>Your inspections and photos are safe on this phone.</p>' +
      '<button class="btn btn-amber btn-block" onclick="location.reload()">Reload</button></div>';
  },
}).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
