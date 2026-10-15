import { useEffect, useLayoutEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, type RoutesProps } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastHost } from '../components/ui';
import { UpdatePrompt } from '../components/UpdatePrompt';
import { useApp } from '../data/store';
import { ChecklistScreen } from '../screens/Checklist';
import { ChecklistDetails } from '../screens/ChecklistDetails';
import { ChecklistExport } from '../screens/ChecklistExport';
import { ChecklistItemScreen } from '../screens/ChecklistItem';
import { EditChecklist } from '../screens/EditChecklist';
import { EvidenceScreen } from '../screens/Evidence';
import { EvidenceExport } from '../screens/EvidenceExport';
import { InstallGate, isIos, isStandalone, Welcome } from '../screens/Gates';
import { Home } from '../screens/Home';
import { NewChecklist } from '../screens/NewChecklist';
import { NewEvidence } from '../screens/NewEvidence';
import { Settings } from '../screens/Settings';
import { CategoryScreen } from '../screens/Category';
import { Templates } from '../screens/Templates';

function ScrollToTop() {
  const { pathname } = useLocation();
  // Before paint, so a new screen never draws at the old screen's scroll position.
  // The braces matter: newer Chrome returns a Promise from scrollTo, and React would call
  // whatever an effect returns as its clean-up when the screen changes.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Catches a crash on one screen; moving to another screen clears it. */
function ScreenBoundary({ children }: Pick<RoutesProps, 'children'>) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Routes>{children}</Routes>
    </ErrorBoundary>
  );
}

const INSTALL_SKIP = 'getech-qc-install-skipped';

export function App() {
  const { ready, storageError, settings, init } = useApp();
  const [skipInstall, setSkipInstall] = useState(() => {
    try {
      return sessionStorage.getItem(INSTALL_SKIP) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  if (storageError) {
    return (
      <div className="gate">
        <h1>This browser is blocking storage</h1>
        <p>Getech QC keeps your work on this phone, so it needs browser storage. Private browsing usually blocks it. Open the app in a normal window, or install it to your home screen.</p>
        <p className="mono small">{storageError}</p>
      </div>
    );
  }
  if (!ready) return <div className="splash">Loading…</div>;
  if (isIos() && !isStandalone() && !skipInstall) {
    return (
      <InstallGate
        onContinue={() => {
          try {
            sessionStorage.setItem(INSTALL_SKIP, '1');
          } catch {
            /* ignore */
          }
          setSkipInstall(true);
        }}
      />
    );
  }
  if (!settings.engineerName)
    return (
      <ErrorBoundary>
        <Welcome />
      </ErrorBoundary>
    );

  return (
    <BrowserRouter>
      <ScrollToTop />
      <ScreenBoundary>
        <Route path="/" element={<Home />} />
        <Route path="/checklists/new" element={<NewChecklist />} />
        <Route path="/checklists/new/details" element={<ChecklistDetails />} />
        <Route path="/checklists/:id" element={<ChecklistScreen />} />
        <Route path="/checklists/:id/items/:itemId" element={<ChecklistItemScreen />} />
        <Route path="/checklists/:id/edit" element={<EditChecklist />} />
        <Route path="/checklists/:id/export" element={<ChecklistExport />} />
        <Route path="/evidence/new" element={<NewEvidence />} />
        <Route path="/evidence/:id" element={<EvidenceScreen />} />
        <Route path="/evidence/:id/c/:catId" element={<CategoryScreen />} />
        <Route path="/evidence/:id/export" element={<EvidenceExport />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </ScreenBoundary>
      <ToastHost />
      <UpdatePrompt />
    </BrowserRouter>
  );
}
