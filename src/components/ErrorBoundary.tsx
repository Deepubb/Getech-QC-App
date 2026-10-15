import { Component, type ErrorInfo, type ReactNode } from 'react';

const RELOAD_KEY = 'getech-qc-auto-reload-at';

/**
 * Errors raised when something outside React changed the page (a browser translating text,
 * an extension) leave nothing on screen. Those are fixed by a fresh load, so the boundary reloads
 * once by itself; any other error shows a screen with a way back instead of a blank page.
 */
function isForeignDomError(err: Error): boolean {
  return err.name === 'NotFoundError' || /removeChild|insertBefore|not a child of this node/i.test(err.message);
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    if (!isForeignDomError(error)) return;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      /* storage blocked: fall through to the screen below */
    }
    if (Date.now() - last > 10_000) window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="gate" role="alert">
        <h1>This screen could not open</h1>
        <p>Your inspections and photos are safe on this phone. Reload to carry on.</p>
        <div className="panel">
          <button className="btn btn-amber btn-block" onClick={() => window.location.reload()}>
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
