import React, { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, X, XCircle, AlertTriangle, Inbox } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-[2px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none tracking-tight';
  const variants = {
    primary: 'bg-[#DB0011] text-white hover:bg-[#B0000D] active:bg-[#8E000A]',
    secondary: 'bg-[#252525] text-white hover:bg-[#383838]',
    outline: 'bg-white text-[#252525] border border-[#9E9E9E] hover:bg-[#F4F4F4]',
    ghost: 'bg-transparent text-[#555555] hover:bg-[#EBEBEB] hover:text-[#252525]',
    danger: 'bg-[#FDF2F2] text-[#B0000D] border border-[#F5C2C7] hover:bg-[#FADBD8]',
  };
  const sizes = {
    sm: 'h-9 px-3.5 text-xs min-w-[44px]',
    md: 'h-[42px] px-4 text-sm min-w-[44px]',
    lg: 'h-12 px-5 text-sm min-w-[44px]',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  requiredMark?: boolean;
  rightAdornment?: React.ReactNode;
}

export const FormInput: React.FC<InputProps> = ({
  label,
  hint,
  error,
  requiredMark,
  rightAdornment,
  id,
  className = '',
  ...rest
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-semibold text-[#252525]">
        {label}
        {requiredMark && <span className="text-[#DB0011] ml-0.5" aria-hidden="true">*</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-[#767676] leading-snug">
          {hint}
        </p>
      )}
      <div className="relative flex items-center">
        <input
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={`w-full min-h-[44px] px-3 py-2 text-sm bg-white border rounded-[2px] text-[#252525] placeholder:text-[#9E9E9E] transition-colors ${
            error ? 'border-[#DB0011] bg-[#FDF2F2]/40' : 'border-[#9E9E9E] hover:border-[#252525]'
          } ${rightAdornment ? 'pr-11' : ''} ${className}`}
          {...rest}
        />
        {rightAdornment && <div className="absolute right-2 flex items-center">{rightAdornment}</div>}
      </div>
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-[#DB0011] font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  requiredMark?: boolean;
}

export const FormSelect: React.FC<SelectProps> = ({
  label,
  hint,
  error,
  requiredMark,
  id,
  children,
  className = '',
  ...rest
}) => {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-xs font-semibold text-[#252525]">
        {label}
        {requiredMark && <span className="text-[#DB0011] ml-0.5" aria-hidden="true">*</span>}
      </label>
      {hint && <p className="text-xs text-[#767676]">{hint}</p>}
      <select
        id={selectId}
        aria-invalid={error ? 'true' : 'false'}
        className={`w-full min-h-[44px] px-3 py-2 text-sm bg-white border rounded-[2px] text-[#252525] ${
          error ? 'border-[#DB0011]' : 'border-[#9E9E9E]'
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#DB0011] font-medium">{error}</p>}
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const normalized = (status || 'PENDING').toUpperCase();
  let style = 'bg-[#F4F4F4] text-[#555555] border-[#D7D8D6]';
  let Icon = Clock;

  if (['ACTIVE', 'COMPLETED', 'AUTHORISED', 'APPROVED', 'ISSUED', 'PAID', 'SETTLED', 'VERIFIED', 'PASSED', 'COMPLETED_SANDBOX'].includes(normalized)) {
    style = 'bg-[#EBF7F0] text-[#008A52] border-[#B7E1CD]';
    Icon = CheckCircle2;
  } else if (['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED', 'PENDING', 'IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW', 'PENDING_CLEARING_SANDBOX', 'SENT'].includes(normalized)) {
    style = 'bg-[#FEF7EC] text-[#9A4A06] border-[#FCD9A5]';
    Icon = Clock;
  } else if (['DORMANT', 'WARNING', 'EXPIRING', 'INFO_REQUESTED'].includes(normalized)) {
    style = 'bg-[#FEF7EC] text-[#9A4A06] border-[#FCD9A5]';
    Icon = AlertTriangle;
  } else if (['REJECTED', 'FAILED', 'FROZEN', 'BLOCKED', 'SUSPENDED', 'LOCKED', 'CANCELLED', 'RETURNED', 'DEACTIVATED', 'CASE_OPENED_SANDBOX'].includes(normalized)) {
    style = 'bg-[#FDF2F2] text-[#B0000D] border-[#F5C2C7]';
    Icon = XCircle;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold border rounded-[2px] px-2 ${
        size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'
      } ${style}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{normalized.replace(/_/g, ' ')}</span>
    </span>
  );
};

interface NativeDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const NativeDialog: React.FC<NativeDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`m-auto w-[calc(100%-2rem)] ${maxWidth} rounded-[2px] bg-white p-0 border border-[#D7D8D6] shadow-xl text-[#252525]`}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#D7D8D6] bg-[#252525] text-white">
        <div>
          <h1 id={titleId} className="text-base font-semibold">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-white/75 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close dialog"
          className="p-1.5 rounded-[2px] text-white/80 hover:text-white hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5 max-h-[80dvh] overflow-y-auto">{children}</div>
    </dialog>
  );
};

export const SectionCard: React.FC<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}> = ({ title, subtitle, action, children, className = '', noPadding = false }) => (
  <section className={`bg-white border border-[#D7D8D6] rounded-[2px] ${className}`}>
    {(title || action) && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#D7D8D6]">
        <div className="border-l-[3px] border-[#DB0011] pl-3">
          {title && <h2 className="text-sm font-semibold text-[#252525]">{title}</h2>}
          {subtitle && <p className="text-xs text-[#767676] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    )}
    <div className={noPadding ? '' : 'p-4 sm:p-5'}>{children}</div>
  </section>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}> = ({ title, description, action, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center text-center py-10 px-4">
    <div className="w-11 h-11 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] flex items-center justify-center text-[#555555] mb-3">
      <Icon className="w-5 h-5" aria-hidden="true" />
    </div>
    <h3 className="text-sm font-semibold text-[#252525]">{title}</h3>
    <p className="text-xs text-[#767676] max-w-sm mt-1 leading-relaxed">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[2px] bg-[#FDF2F2] border-l-4 border-[#DB0011] border border-[#F5C2C7] text-[#B0000D] text-xs">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">{message}</span>
    </div>
    {onRetry && (
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading records">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-14 rounded-[2px] bg-[#EBEBEB] animate-pulse" />
    ))}
  </div>
);
