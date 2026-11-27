import React from 'react';

interface GeometricHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  variant?: 'default' | 'compact' | 'tall';
  className?: string;
}

/**
 * Reusable HSBCnet-inspired dark geometric architectural header.
 * Uses #263640 base with crisp faceted diagonal planes (#344651 and #202A30) via original SVG geometry.
 */
export const GeometricHeader: React.FC<GeometricHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  actions,
  variant = 'default',
  className = '',
}) => {
  const heightClass =
    variant === 'compact'
      ? 'pt-5 pb-4'
      : variant === 'tall'
      ? 'pt-7 pb-6 sm:pt-9 sm:pb-7'
      : 'pt-6 pb-5 sm:pt-8 sm:pb-6';

  return (
    <header
      className={`relative overflow-hidden bg-[#263640] text-white select-none ${heightClass} ${className}`}
    >
      {/* Original Architectural Faceted Geometric Backdrop */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 240"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        <rect width="1200" height="240" fill="#263640" />
        {/* Large diagonal ascending slate plane */}
        <polygon points="0,240 520,240 890,0 260,0" fill="#344651" opacity="0.65" />
        {/* Deep charcoal lower-right angular plane */}
        <polygon points="620,240 1200,240 1200,40 860,115" fill="#202A30" opacity="0.88" />
        {/* Crisp intersecting diagonal facet */}
        <polygon points="910,0 1200,0 1200,130 780,150" fill="#344651" opacity="0.45" />
        {/* Thin subtle structural edge */}
        <line x1="520" y1="240" x2="890" y2="0" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="1.5" />
      </svg>

      <div className="relative z-10 px-4 sm:px-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/70 mb-1 truncate">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[24px] sm:text-[30px] font-light tracking-[-0.015em] leading-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs text-white/75 truncate">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-1 shrink-0 pt-0.5">{actions}</div>
        )}
      </div>
    </header>
  );
};
