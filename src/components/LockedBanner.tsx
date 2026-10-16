import { KeyRound } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../data/store';

/** Shown when the server asks for the team code again, e.g. after the code was changed. */
export function LockedBanner() {
  const locked = useApp((s) => s.locked);
  const { pathname } = useLocation();
  if (!locked) return null;
  return (
    <div className="locked-bar" role="alert">
      <KeyRound />
      <span className="grow">Enter the team code to get updates.</span>
      <button
        className="btn btn-sm btn-accent"
        onClick={() => {
          // A full page load, so it reaches the server instead of the app's saved copy.
          window.location.href = `/unlock?next=${encodeURIComponent(pathname)}`;
        }}
      >
        Enter code
      </button>
    </div>
  );
}
