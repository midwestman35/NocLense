import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextType {
  toast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const MAX_TOASTS = 3;

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: 'border-[rgba(139,229,255,0.24)]',
  success: 'border-[rgba(142,240,183,0.32)]',
  warning: 'border-[rgba(247,185,85,0.28)]',
  error: 'border-[rgba(255,107,122,0.3)]',
};

const VARIANT_ICONS: Record<ToastVariant, ReactNode> = {
  info: <Info size={14} className="shrink-0 text-[var(--cyan)]" />,
  success: <CheckCircle size={14} className="shrink-0 text-[var(--mint)]" />,
  warning: <AlertTriangle size={14} className="shrink-0 text-[var(--amber)]" />,
  error: <AlertCircle size={14} className="shrink-0 text-[var(--red)]" />,
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={clsx(
        'glass flex items-start gap-2.5 rounded-[var(--radius-panel)] px-3.5 py-3',
        'text-xs leading-relaxed text-[var(--ink-1)] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]',
        'before:mt-1 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-[var(--mint)] before:shadow-[0_0_10px_var(--mint)]',
        'animate-toast-in',
        VARIANT_STYLES[item.variant]
      )}
      role="alert"
    >
      {VARIANT_ICONS[item.variant]}
      <span className="flex-1 min-w-0">{item.message}</span>
      {item.action && (
        <button
          onClick={() => { item.action!.onClick(); onDismiss(item.id); }}
          className="shrink-0 font-medium text-[var(--mint)] underline underline-offset-2 hover:no-underline"
        >
          {item.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 p-0.5 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-0)]"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const variant = options?.variant ?? 'info';
    const duration = options?.duration ?? 4000;

    const item: ToastItem = { id, message, variant, duration, action: options?.action };

    setToasts((prev) => {
      const next = [...prev, item];
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="pointer-events-auto fixed bottom-4 right-4 z-[var(--z-toast)] flex w-80 flex-col gap-2"
          aria-live="polite"
        >
          {toasts.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
