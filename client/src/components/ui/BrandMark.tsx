import React from 'react';

interface BrandMarkProps {
  size?: number;
  variant?: 'color' | 'light' | 'wordmark';
  showWordmark?: boolean;
  className?: string;
}

/**
 * Official HSBCnet portal header hexagon emblem + optional crisp HSBC wordmark
 * matching the uploaded portal screenshots.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 32,
  variant = 'color',
  showWordmark = false,
  className = '',
}) => {
  const hexHeight = Math.round(size * 0.54);
  return (
    <span className={`inline-flex items-center gap-2 shrink-0 select-none ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 42"
        width={size}
        height={hexHeight}
        aria-hidden="true"
        className="shrink-0"
      >
        <polygon points="2,21 21,2 21,40" fill="#DB001B" />
        <polygon points="78,21 59,2 59,40" fill="#DB001B" />
        <polygon points="21,2 59,2 40,21" fill="#DB001B" />
        <polygon points="21,40 59,40 40,21" fill="#DB001B" />
        <polygon points="21,2 40,21 21,40" fill="#FFFFFF" />
        <polygon points="59,2 40,21 59,40" fill="#FFFFFF" />
      </svg>
      {(showWordmark || variant === 'wordmark') && (
        <span className={`font-semibold tracking-tight leading-none ${variant === 'light' || variant === 'color' ? 'text-white' : 'text-[#252B30]'}`} style={{ fontSize: Math.max(15, Math.round(size * 0.44)) }}>
          HSBC<span className="font-light italic ml-0.5">net</span>
        </span>
      )}
    </span>
  );
};
