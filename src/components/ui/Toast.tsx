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

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const MAX_TOASTS = 3;

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: 'border-[var(--info)]/30 bg-[var(--info)]/5',
  success: 'border-[var(--success)]/30 bg-[var(--success)]/5',
  warning: 'border-[var(--warning)]/30 bg-[var(--warning)]/5',
  error: 'border-[var(--destructive)]/30 bg-[var(--destructive)]/5',
};

const VARIANT_ICONS: Record<ToastVariant, ReactNode> = {
  info: <Info size={14} className="text-[var(--info)] shrink-0" />,
  success: <CheckCircle size={14} className="text-[var(--success)] shrink-0" />,
  warning: <AlertTriangle size={14} className="text-[var(--warning)] shrink-0" />,
  error: <AlertCircle size={14} className="text-[var(--destructive)] shrink-0" />,
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={clsx(
        'flex items-start gap-2.5 px-3.5 py-3 rounded-[var(--radius-lg)] border shadow-[var(--shadow-md)]',
        'bg-[var(--card)] text-[var(--card-foreground)] text-xs leading-relaxed',
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
          className="shrink-0 font-medium text-[var(--foreground)] underline underline-offset-2 hover:no-underline"
        >
          {item.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-0.5"
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
          className="fixed bottom-4 right-4 z-[var(--z-toast)] flex flex-col gap-2 w-80 pointer-events-auto"
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
