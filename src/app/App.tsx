import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
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
  if (!settings.engineerName) return <Welcome />;

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
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
      </Routes>
      <ToastHost />
      <UpdatePrompt />
    </BrowserRouter>
  );
}
