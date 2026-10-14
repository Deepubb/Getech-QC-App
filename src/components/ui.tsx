import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export function AppBar({ title, sub, back = true, actions }: { title: string; sub?: string; back?: boolean | string; actions?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="appbar">
      {back ? (
        <button
          className="iconbtn"
          aria-label="Back"
          onClick={() => (typeof back === 'string' ? nav(back) : window.history.length > 1 ? nav(-1) : nav('/'))}
        >
          <ChevronLeft />
        </button>
      ) : null}
      <div className="titles">
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {actions}
    </header>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmSheet(props: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title}>
      <div className="muted">{props.body}</div>
      <div className="btn-row">
        <button className="btn" onClick={props.onClose}>
          Cancel
        </button>
        <button
          className={`btn ${props.danger ? 'btn-danger-solid' : 'btn-primary'}`}
          onClick={() => {
            props.onConfirm();
            props.onClose();
          }}
        >
          {props.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

type Tone = 'good' | 'bad' | 'info';
interface ToastState {
  message: string | null;
  tone: Tone;
  show(message: string, tone?: Tone): void;
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  show(message, tone = 'info') {
    clearTimeout(toastTimer);
    set({ message, tone });
    toastTimer = setTimeout(() => set({ message: null }), 2800);
  },
}));
export const toast = (message: string, tone: Tone = 'info') => useToast.getState().show(message, tone);

export function ToastHost() {
  const { message, tone } = useToast();
  if (!message) return null;
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? AlertTriangle : Info;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast">
        <Icon />
        {message}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function vibrate(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
