import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logProblem } from '../data/problemLog';

const RELOAD_KEY = 'getech-qc-auto-reload-at';

/**
 * Errors raised when something outside React changed the page (a browser translating text,
 * an extension) leave nothing on screen. Those are fixed by a fresh load, so the boundary reloads
 * once by itself; any other error shows a screen with a way back instead of a blank page.
 */
function isForeignDomError(err: Error): boolean {
  return err.name === 'NotFoundError' || /removeChild|insertBefore|not a child of this node/i.test(err.message);
}

/** Reloads the page unless it already did so in the last 10 seconds, so a crash can never loop. */
export function reloadOnce(): boolean {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked: reload anyway, the browser stops a tight loop */
  }
  if (Date.now() - last <= 10_000) return false;
  window.location.reload();
  return true;
}

type Props = { children: ReactNode; resetKey?: string };

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // Moving to another screen clears the error. The boundary itself stays mounted, so an error
    // thrown while the old screen is being removed still lands here and not on a blank page.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    logProblem(`${error.name}: ${error.message}`);
    if (isForeignDomError(error)) reloadOnce();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="gate" role="alert">
        <h1>This screen could not open</h1>
        <p>Your inspections and photos are safe on this phone. Reload to carry on.</p>
        <div className="panel">
          <button className="btn btn-accent btn-block" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            className="btn btn-block"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Go to home
          </button>
          <p className="tiny mono wrap-anywhere">{error.message}</p>
        </div>
      </div>
    );
  }
}
