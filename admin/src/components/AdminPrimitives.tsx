import React, { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, X, XCircle } from 'lucide-react';

export const AdminBrandMark: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <img
    src="/logo.jpg"
    alt="HSBCnet Admin logo"
    width={size}
    height={size}
    style={{ width: size, height: size }}
    className="object-cover rounded-[2px] shrink-0 select-none"
  />
);

export const AdminButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger';
    size?: 'sm' | 'md';
    loading?: boolean;
  }
> = ({ variant = 'primary', size = 'md', loading, disabled, children, className = '', type = 'button', ...rest }) => {
  const variants = {
    primary: 'bg-[#C8102E] text-white hover:bg-[#A30C24]',
    secondary: 'bg-[#14233C] text-white hover:bg-[#1D3152]',
    outline: 'bg-white text-[#181C20] border border-[#CBD2DC] hover:bg-[#F5F6F8]',
    danger: 'bg-[#FEF2F2] text-[#A81212] border border-[#FECACA] hover:bg-[#FEE2E2]',
  };
  const sizes = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
  };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
};

export const AdminBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = (status || 'ACTIVE').toUpperCase();
  let cls = 'bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]';
  let Icon = Clock;
  if (['ACTIVE', 'COMPLETED', 'OPERATIONAL', 'RESOLVED', 'APPROVED', 'ISSUED'].includes(s)) {
    cls = 'bg-[#ECFDF3] text-[#0E6235] border-[#ABEFC6]';
    Icon = CheckCircle2;
  } else if (['SUSPENDED', 'LOCKED', 'REJECTED', 'FAILED', 'FROZEN', 'CASE_OPENED_SANDBOX'].includes(s)) {
    cls = 'bg-[#FEF2F2] text-[#A81212] border-[#FECACA]';
    Icon = XCircle;
  } else if (['AWAITING_AUTHORISATION', 'OPEN', 'IN_PROGRESS'].includes(s)) {
    cls = 'bg-[#EFF4FF] text-[#174291] border-[#C7D7FE]';
    Icon = Clock;
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${cls}`}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      {s.replace(/_/g, ' ')}
    </span>
  );
};

export const AdminCard: React.FC<{ title?: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  subtitle,
  action,
  children,
}) => (
  <section className="bg-white border border-[#E2E6EC] rounded-lg shadow-[0_1px_2px_rgba(20,35,60,0.04)]">
    {(title || action) && (
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#E2E6EC] flex flex-wrap items-center justify-between gap-3">
        <div>
          {title && <h2 className="text-sm font-semibold text-[#181C20]">{title}</h2>}
          {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="p-4 sm:p-5">{children}</div>
  </section>
);

export const AdminDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const h = () => {
      d.returnValue = '';
      onClose();
    };
    d.addEventListener('close', h);
    return () => d.removeEventListener('close', h);
  }, [onClose]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-lg bg-white p-0 border border-[#E2E6EC] shadow-xl">
      <div className="px-5 py-3.5 border-b border-[#E2E6EC] bg-[#F9FAFB] flex items-center justify-between">
        <h1 id={titleId} className="text-base font-semibold text-[#181C20]">{title}</h1>
        <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="p-1.5 rounded hover:bg-[#ECEFF3]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 max-h-[80dvh] overflow-y-auto">{children}</div>
    </dialog>
  );
};

export const AdminError: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="p-3 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#A81212] flex items-center gap-2">
    <AlertCircle className="w-4 h-4 shrink-0" />
    <span>{message}</span>
  </div>
);
