import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';

export function Page({
  title,
  subtitle,
  back,
  actions,
  children,
  bottomPad = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: boolean | string;
  actions?: ReactNode;
  children: ReactNode;
  bottomPad?: boolean;
}) {
  const nav = useNavigate();
  return (
    <div className={`min-h-full safe-top ${bottomPad ? 'pb-40' : ''}`}>
      <header className="px-5 pt-4">
        <div className="flex h-11 items-center justify-between -mx-2">
          {back ? (
            <button className="btn-ghost -ml-1 px-2 text-accent" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
              <ChevronLeft size={22} strokeWidth={2.2} />
              <span className="text-[15px]">Atrás</span>
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">{actions}</div>
        </div>
        {title && (
          <div className="mt-1 mb-5">
            {subtitle && <div className="eyebrow mb-1">{subtitle}</div>}
            <h1 className="text-[30px] font-bold tracking-[-0.02em] leading-tight">{title}</h1>
          </div>
        )}
      </header>
      <main className="px-5 anim-rise">{children}</main>
    </div>
  );
}

export function Section({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-7 ${className}`}>
      {(title || action) && (
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-mute">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 anim-fade" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-[28px] bg-surface anim-sheet safe-bottom" style={{ boxShadow: 'inset 0 1px 0 rgb(var(--line) / 0.08)' }}>
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-mute/40" />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-icon -mr-2" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="px-5 pb-4 pt-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Confirmación

type ConfirmOpts = { title: string; body?: string; confirm?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

// ── Toasts

type Toast = { id: number; text: ReactNode; tone?: 'accent' | 'default' };
const ToastCtx = createContext<(text: ReactNode, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const n = useRef(0);

  const toast = useCallback((text: ReactNode, tone: Toast['tone'] = 'default') => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })), []);
  const close = (v: boolean) => {
    confirm?.resolve(v);
    setConfirm(null);
  };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={ask}>
        {children}
        {createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 safe-top" style={{ marginTop: 64 }} aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`anim-pop pointer-events-auto rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg ${t.tone === 'accent' ? 'bg-accent text-onaccent' : 'bg-raised text-ink'}`}
              >
                {t.text}
              </div>
            ))}
          </div>,
          document.body,
        )}
        {confirm &&
          createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="alertdialog">
              <div className="absolute inset-0 bg-black/60 anim-fade" onClick={() => close(false)} />
              <div className="card relative w-full max-w-sm p-5 anim-pop">
                <h3 className="text-lg font-semibold">{confirm.title}</h3>
                {confirm.body && <p className="mt-1.5 text-[15px] text-sub leading-snug">{confirm.body}</p>}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button className="btn-secondary" onClick={() => close(false)}>
                    Cancelar
                  </button>
                  <button className={`btn h-12 ${confirm.danger ? 'bg-bad text-white' : 'bg-accent text-onaccent'}`} onClick={() => close(true)}>
                    {confirm.confirm ?? 'Aceptar'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-mute">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-xs text-sm text-sub">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, foot, className = '' }: { label: string; value: ReactNode; unit?: string; foot?: ReactNode; className?: string }) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[26px] font-semibold tracking-tight tnum leading-none">{value}</span>
        {unit && <span className="text-sm text-sub">{unit}</span>}
      </div>
      {foot && <div className="mt-1.5 text-xs text-sub">{foot}</div>}
    </div>
  );
}

export function Row({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${onClick ? 'active:bg-raised transition-colors' : ''} ${className}`}>
      {children}
    </Cmp>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-raised'}`}
    >
      <span className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** Campo numérico grande para el gym (teclado decimal). */
export function NumInput({
  value,
  onChange,
  placeholder,
  decimal = true,
  className = '',
  ariaLabel,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  className?: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : fmt(value));
  }, [value]);
  return (
    <input
      aria-label={ariaLabel}
      disabled={disabled}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="next"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(value == null ? '' : fmt(value));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,]/g, '');
        setText(raw);
        const t = raw.replace(',', '.');
        if (t === '') return onChange(null);
        const n = decimal ? parseFloat(t) : parseInt(t, 10);
        if (Number.isFinite(n) && n >= 0 && n < 10000) onChange(n);
      }}
      className={`tnum h-12 w-full rounded-xl bg-raised text-center text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-mute focus:ring-2 focus:ring-accent/70 disabled:opacity-60 ${className}`}
    />
  );
}

const fmt = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
