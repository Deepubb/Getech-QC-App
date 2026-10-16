/**
 * Keeps installed phones on the latest version. Phones resume the app from memory instead of
 * reloading it, so the app looks for a new version itself and installs it as soon as nothing can
 * be lost: no sheet or field in use, and never while the camera is open.
 */

let registration: ServiceWorkerRegistration | undefined;
let captureAt = 0;
const CAPTURE_GRACE = 3 * 60 * 1000;

export function setRegistration(reg: ServiceWorkerRegistration | undefined) {
  registration = reg;
}

/** The camera or gallery is open: a reload now would lose the photo being taken. */
export function markCapture(open: boolean) {
  captureAt = open ? Date.now() : 0;
}

export function safeToUpdate(): boolean {
  if (captureAt && Date.now() - captureAt < CAPTURE_GRACE) return false;
  if (document.visibilityState !== 'visible') return false;
  if (document.querySelector('.backdrop')) return false;
  const el = document.activeElement;
  return !(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** Asks the server for a newer version. True when one was found and is being installed. */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false;
  await registration.update().catch(() => undefined);
  if (registration.waiting) return true;
  const installing = registration.installing;
  if (!installing) return false;
  return new Promise((resolve) => {
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') resolve(true);
      if (installing.state === 'redundant') resolve(false);
    });
  });
}

/**
 * Switches to the downloaded version and reloads. The new version also reloads open windows
 * itself (public/sw-reload.js); this reload covers a browser that does not.
 */
export async function applyUpdate(): Promise<void> {
  const waiting = registration?.waiting;
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 3000);
    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
  window.location.reload();
}
