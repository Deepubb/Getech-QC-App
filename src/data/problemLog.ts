/**
 * A short log of errors on this phone, kept in localStorage so it survives the reload that
 * usually follows a crash. Settings shows it so an engineer can copy it and send it on.
 */
const KEY = 'getech-qc-problems';
const MAX = 20;

export interface Problem {
  at: string;
  path: string;
  message: string;
}

export function readProblems(): Problem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as Problem[];
  } catch {
    return [];
  }
}

export function logProblem(message: string) {
  try {
    const next = [...readProblems(), { at: new Date().toISOString(), path: location.pathname, message: message.slice(0, 500) }];
    localStorage.setItem(KEY, JSON.stringify(next.slice(-MAX)));
  } catch {
    /* storage blocked: nothing to keep */
  }
}

export function clearProblems() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function watchProblems() {
  window.addEventListener('error', (e) => logProblem(e.error instanceof Error ? `${e.error.name}: ${e.error.message}` : e.message || 'Unknown error'));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    logProblem(r instanceof Error ? `${r.name}: ${r.message}` : `Unhandled: ${String(r)}`);
  });
}
