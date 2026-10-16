import { Share, SquarePlus } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/getech-logo.png';
import { useApp } from '../data/store';

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallGate({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="gate">
      <div className="logo-plate">
        <img src={logo} alt="GeTech" width={528} height={146} />
      </div>
      <h1>Install the app before you start</h1>
      <p>On iPhone, work started in Safari is kept separately from the installed app and can be cleared. Installing keeps your photos safe and lets the app work offline.</p>
      <div className="panel">
        <ol className="steps">
          <li>
            <span>
              Tap <Share size={16} style={{ verticalAlign: '-3px' }} /> <b>Share</b> at the bottom of Safari.
            </span>
          </li>
          <li>
            <span>
              Choose <SquarePlus size={16} style={{ verticalAlign: '-3px' }} /> <b>Add to Home Screen</b>, then <b>Add</b>.
            </span>
          </li>
          <li>
            <span>
              Open <b>Getech QC</b> from your home screen.
            </span>
          </li>
        </ol>
      </div>
      <button className="btn btn-ghost" style={{ color: 'var(--on-navy-muted)' }} onClick={onContinue}>
        Continue in Safari anyway
      </button>
    </div>
  );
}

export function Welcome() {
  const saveSettings = useApp((s) => s.saveSettings);
  const [name, setName] = useState('');
  return (
    <form
      className="gate"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) void saveSettings({ engineerName: name.trim() });
      }}
    >
      <div className="logo-plate">
        <img src={logo} alt="GeTech" width={528} height={146} />
      </div>
      <h1>QC photo evidence, on your phone</h1>
      <p>Tap each photo name from your machine list, take the photo, and send one zip in the right folders wherever you like. It works without signal.</p>
      <div className="panel">
        <label className="field">
          <span className="label">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Deepak" autoFocus />
        </label>
        <p className="small">No password. Everything stays on this phone until you export it.</p>
        <button className="btn btn-accent btn-block" type="submit" disabled={!name.trim()}>
          Get started
        </button>
      </div>
    </form>
  );
}
