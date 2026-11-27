import React, { useEffect, useId, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';

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
    'inline-flex items-center justify-center gap-2 font-medium rounded-[2px] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed select-none tracking-tight';
  const variants = {
    primary: 'bg-[#DB001B] text-white hover:bg-[#B80016] active:bg-[#960012]',
    secondary: 'bg-[#263640] text-white hover:bg-[#344651] active:bg-[#202A30]',
    outline: 'bg-white text-[#252B30] border border-[#B4BCC2] hover:bg-[#F4F5F6]',
    ghost: 'bg-transparent text-[#68727A] hover:bg-[#F4F5F6] hover:text-[#252B30]',
    danger: 'bg-white text-[#C83A42] border border-[#C83A42] hover:bg-[#FDF2F3]',
  };
  const sizes = {
    sm: 'h-9 px-3.5 text-xs min-w-[44px]',
    md: 'h-[44px] px-4 text-sm min-w-[44px]',
    lg: 'h-12 px-5 text-[15px] min-w-[44px]',
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
      <label htmlFor={inputId} className="text-xs font-medium text-[#252B30]">
        {label}
        {requiredMark && <span className="text-[#DB001B] ml-0.5" aria-hidden="true">*</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-[#68727A] leading-snug">
          {hint}
        </p>
      )}
      <div className="relative flex items-center">
        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border rounded-[2px] text-[#252B30] placeholder:text-[#68727A]/70 transition-colors ${
            error ? 'border-[#C83A42] bg-[#FDF2F3]/35' : 'border-[#B4BCC2] hover:border-[#263640]'
          } ${rightAdornment ? 'pr-11' : ''} ${className}`}
          {...rest}
        />
        {rightAdornment && <div className="absolute right-2 flex items-center">{rightAdornment}</div>}
      </div>
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-[#C83A42] font-medium">
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
  const errorId = `${selectId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-xs font-medium text-[#252B30]">
        {label}
        {requiredMark && <span className="text-[#DB001B] ml-0.5" aria-hidden="true">*</span>}
      </label>
      {hint && <p className="text-xs text-[#68727A]">{hint}</p>}
      <select
        id={selectId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border rounded-[2px] text-[#252B30] ${
          error ? 'border-[#C83A42]' : 'border-[#B4BCC2] hover:border-[#263640]'
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p id={errorId} className="text-xs text-[#C83A42] font-medium">{error}</p>}
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const normalized = (status || 'PENDING').toUpperCase();
  let style = 'bg-[#F4F5F6] text-[#68727A] border-[#D9DEE1]';
  let Icon = Clock;

  if (
    ['ACTIVE', 'COMPLETED', 'AUTHORISED', 'APPROVED', 'ISSUED', 'PAID', 'SETTLED', 'VERIFIED', 'PASSED', 'COMPLETED_SANDBOX'].includes(
      normalized
    )
  ) {
    style = 'bg-[#ECF6F1] text-[#27835B] border-[#B7DFCC]';
    Icon = CheckCircle2;
  } else if (
    ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED', 'PENDING', 'IN_PROGRESS', 'PROCESSING', 'UNDER_REVIEW', 'PENDING_CLEARING_SANDBOX', 'SENT', 'SUBMITTED'].includes(
      normalized
    )
  ) {
    style = 'bg-[#FBF5EA] text-[#B77A1D] border-[#EBD3A7]';
    Icon = Clock;
  } else if (['DORMANT', 'WARNING', 'EXPIRING', 'INFO_REQUESTED', 'REPAIR_REQUESTED', 'SEND_TO_REPAIR'].includes(normalized)) {
    style = 'bg-[#FBF5EA] text-[#B77A1D] border-[#EBD3A7]';
    Icon = AlertTriangle;
  } else if (
    ['REJECTED', 'FAILED', 'FROZEN', 'BLOCKED', 'SUSPENDED', 'LOCKED', 'CANCELLED', 'RETURNED', 'DEACTIVATED', 'CASE_OPENED_SANDBOX'].includes(
      normalized
    )
  ) {
    style = 'bg-[#FDF2F3] text-[#C83A42] border-[#F1C1C4]';
    Icon = XCircle;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium border rounded-[2px] px-2 ${
        size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'
      } ${style}`}
    >
      <Icon className="w-3 h-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
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
      className={`m-auto w-[calc(100%-2rem)] ${maxWidth} rounded-[2px] bg-white p-0 border border-[#D9DEE1] shadow-xl text-[#252B30]`}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#D9DEE1] bg-[#263640] text-white">
        <div>
          <h1 id={titleId} className="text-base font-medium">
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
  <section className={`bg-white border border-[#D9DEE1] ${className}`}>
    {(title || action) && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#F4F5F6] border-b border-[#D9DEE1]">
        <div className="min-w-0">
          {title && <h2 className="text-xs font-semibold uppercase tracking-wide text-[#68727A]">{title}</h2>}
          {subtitle && <p className="text-xs text-[#68727A] mt-0.5 normal-case">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    )}
    <div className={noPadding ? '' : 'p-4'}>{children}</div>
  </section>
);

export const BankingListRow: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightText?: React.ReactNode;
  rightSubtext?: React.ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
  leftSlot?: React.ReactNode;
  disabled?: boolean;
}> = ({
  title,
  subtitle,
  rightText,
  rightSubtext,
  onClick,
  showChevron = true,
  leftSlot,
  disabled = false,
}) => {
  const interactive = !!onClick && !disabled;
  const content = (
    <div className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {leftSlot && <div className="shrink-0 mt-0.5">{leftSlot}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-normal text-[#252B30] truncate">{title}</div>
          {subtitle && <div className="text-xs text-[#68727A] mt-0.5 truncate">{subtitle}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-right">
        {(rightText !== undefined || rightSubtext !== undefined) && (
          <div>
            {rightText !== undefined && (
              <div className="text-sm font-medium text-[#252B30] tabular-nums">{rightText}</div>
            )}
            {rightSubtext !== undefined && (
              <div className="text-[11px] text-[#68727A] tabular-nums">{rightSubtext}</div>
            )}
          </div>
        )}
        {showChevron && interactive && (
          <ChevronRight className="w-4 h-4 text-[#68727A]" strokeWidth={1.75} aria-hidden="true" />
        )}
      </div>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full bg-white hover:bg-[#F4F5F6] transition-colors border-b border-[#D9DEE1] last:border-b-0 block"
      >
        {content}
      </button>
    );
  }

  return <div className="w-full bg-white border-b border-[#D9DEE1] last:border-b-0">{content}</div>;
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}> = ({ title, description, action, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center text-center py-10 px-4 bg-white">
    <div className="w-10 h-10 rounded-[2px] bg-[#F4F5F6] border border-[#D9DEE1] flex items-center justify-center text-[#68727A] mb-3">
      <Icon className="w-5 h-5" aria-hidden="true" />
    </div>
    <h3 className="text-sm font-medium text-[#252B30]">{title}</h3>
    <p className="text-xs text-[#68727A] max-w-sm mt-1 leading-relaxed">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#FDF2F3] border-l-4 border-[#C83A42] border border-[#F1C1C4] text-[#C83A42] text-xs"
  >
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

export const ErrorState = ErrorBanner;

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="divide-y divide-[#D9DEE1] bg-white border-y border-[#D9DEE1]" aria-busy="true" aria-label="Loading records">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="px-4 py-4 flex justify-between items-center gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-3.5 w-44 bg-[#E9ECEF] animate-pulse rounded-[2px]" />
          <div className="h-3 w-28 bg-[#F4F5F6] animate-pulse rounded-[2px]" />
        </div>
        <div className="h-4 w-24 bg-[#E9ECEF] animate-pulse rounded-[2px]" />
      </div>
    ))}
  </div>
);

export const LoadingState = SkeletonList;
